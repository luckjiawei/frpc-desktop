use log::{Level, LevelFilter, Log, Metadata, Record};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Rotate main.log to main.old.log once it grows past this size.
const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024;

/// Writes `log` records to the application log file (`log/main.log`) using the
/// electron-log style `[time] [level] message` lines the log view parses.
struct FileLogger {
    file: Mutex<File>,
}

impl FileLogger {
    fn is_own_target(target: &str) -> bool {
        target.starts_with(env!("CARGO_CRATE_NAME"))
    }
}

impl Log for FileLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        // Keep our own info logs, but only warnings and errors from dependencies.
        let max = if Self::is_own_target(metadata.target()) {
            Level::Debug
        } else {
            Level::Warn
        };
        metadata.level() <= max
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let level = match record.level() {
            Level::Error => "error",
            Level::Warn => "warn",
            Level::Info => "info",
            Level::Debug | Level::Trace => "debug",
        };
        let line = format!(
            "[{}] [{}] {}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
            level,
            record.args()
        );
        if cfg!(debug_assertions) {
            eprint!("{}", line);
        }
        if let Ok(mut file) = self.file.lock() {
            let _ = file.write_all(line.as_bytes());
        }
    }

    fn flush(&self) {
        if let Ok(mut file) = self.file.lock() {
            let _ = file.flush();
        }
    }
}

/// Installs the global file logger. Safe to call once at startup; failures are
/// reported to stderr and leave logging disabled rather than aborting startup.
pub fn init(path: &Path) {
    rotate_if_large(path);
    let file = match OpenOptions::new().create(true).append(true).open(path) {
        Ok(file) => file,
        Err(e) => {
            eprintln!("Failed to open app log {:?}: {}", path, e);
            return;
        }
    };
    let logger = FileLogger {
        file: Mutex::new(file),
    };
    let level = if cfg!(debug_assertions) {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    };
    let logger: &'static FileLogger = Box::leak(Box::new(logger));
    if log::set_logger(logger).is_ok() {
        log::set_max_level(level);
    }
}

fn rotate_if_large(path: &Path) {
    let too_large = fs::metadata(path)
        .map(|m| m.len() > MAX_LOG_SIZE)
        .unwrap_or(false);
    if too_large {
        let mut old: PathBuf = path.to_path_buf();
        old.set_extension("old.log");
        let _ = fs::rename(path, old);
    }
}

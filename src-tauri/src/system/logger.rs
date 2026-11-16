use log::{Level, LevelFilter, Log, Metadata, Record};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;

/// Rotate main.log to main.old.log once it grows past this size.
const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024;

/// App log levels ordered from least to most verbose. Stored in an atomic so
/// the level saved in settings can be applied without restarting the app.
const LEVEL_ERROR: u8 = 1;
const LEVEL_WARN: u8 = 2;
const LEVEL_INFO: u8 = 3;
const LEVEL_DEBUG: u8 = 4;

static APP_LEVEL: AtomicU8 = AtomicU8::new(LEVEL_INFO);

fn level_rank(level: &str) -> Option<u8> {
    match level {
        "error" => Some(LEVEL_ERROR),
        "warn" => Some(LEVEL_WARN),
        "info" => Some(LEVEL_INFO),
        "debug" => Some(LEVEL_DEBUG),
        _ => None,
    }
}

fn rank_of(level: Level) -> u8 {
    match level {
        Level::Error => LEVEL_ERROR,
        Level::Warn => LEVEL_WARN,
        Level::Info => LEVEL_INFO,
        Level::Debug | Level::Trace => LEVEL_DEBUG,
    }
}

fn filter_for(rank: u8) -> LevelFilter {
    match rank {
        LEVEL_ERROR => LevelFilter::Error,
        LEVEL_WARN => LevelFilter::Warn,
        LEVEL_DEBUG => LevelFilter::Debug,
        _ => LevelFilter::Info,
    }
}

fn default_rank() -> u8 {
    if cfg!(debug_assertions) {
        LEVEL_DEBUG
    } else {
        LEVEL_INFO
    }
}

pub fn is_valid_level(level: &str) -> bool {
    level_rank(level).is_some()
}

/// Applies the app log level. Unknown values fall back to the build default.
pub fn set_level(level: &str) {
    let rank = level_rank(level).unwrap_or_else(default_rank);
    APP_LEVEL.store(rank, Ordering::Relaxed);
    log::set_max_level(filter_for(rank));
}

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
        // The configured level applies to the app itself; dependency output is
        // capped at warnings so crate debug output cannot flood main.log.
        let configured = APP_LEVEL.load(Ordering::Relaxed);
        let max = if Self::is_own_target(metadata.target()) {
            configured
        } else {
            configured.min(LEVEL_WARN)
        };
        rank_of(metadata.level()) <= max
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
/// The persisted level is applied later with [`set_level`] once the database
/// is available.
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
    let rank = default_rank();
    APP_LEVEL.store(rank, Ordering::Relaxed);
    let logger: &'static FileLogger = Box::leak(Box::new(logger));
    if log::set_logger(logger).is_ok() {
        log::set_max_level(filter_for(rank));
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

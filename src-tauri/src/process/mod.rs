use crate::models::{ApiResponse, FrpcProcessStatus};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct ProcessManager {
    inner: Arc<Mutex<ProcessState>>,
    is_running_flag: Arc<AtomicBool>,
}

struct ProcessState {
    child_pid: Option<u32>,
    last_start_time: i64,
    connection_error: Option<String>,
    log_path: PathBuf,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(ProcessState {
                child_pid: None,
                last_start_time: -1,
                connection_error: None,
                log_path: PathBuf::new(),
            })),
            is_running_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn is_running(&self) -> bool {
        self.is_running_flag.load(Ordering::SeqCst)
    }

    pub async fn get_status(&self) -> FrpcProcessStatus {
        let state = self.inner.lock().await;
        FrpcProcessStatus {
            running: self.is_running_flag.load(Ordering::SeqCst),
            connection_error: state.connection_error.clone(),
            last_start_time: if state.last_start_time > 0 {
                Some(state.last_start_time)
            } else {
                None
            },
        }
    }

    pub async fn start(
        &self,
        app: AppHandle,
        binary_path: &Path,
        config_path: &Path,
        log_path: &Path,
    ) -> anyhow::Result<()> {
        if self.is_running().await {
            return Ok(());
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_millis() as i64;

        {
            let mut state = self.inner.lock().await;
            state.connection_error = None;
            state.last_start_time = now;
            state.log_path = log_path.to_path_buf();
        }

        let mut cmd = Command::new(binary_path);
        cmd.arg("-c").arg(config_path);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn()?;
        let pid = child.id().unwrap_or(0);

        {
            let mut state = self.inner.lock().await;
            state.child_pid = Some(pid);
        }
        self.is_running_flag.store(true, Ordering::SeqCst);

        // Emit initial started status
        let initial_status = self.get_status().await;
        let _ = app.emit("frpcProcess:watchFrpcLog", ApiResponse::success(initial_status));

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let log_file_path = log_path.to_path_buf();

        let inner_clone = self.inner.clone();
        let running_flag_clone = self.is_running_flag.clone();
        let app_clone = app.clone();

        // Spawn background task to monitor child exit and logs
        tauri::async_runtime::spawn(async move {
            let log_file_path_stdout = log_file_path.clone();
            let app_out = app_clone.clone();
            let inner_out = inner_clone.clone();

            if let Some(stdout) = stdout {
                tauri::async_runtime::spawn(async move {
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        Self::write_log_line(&log_file_path_stdout, &line);
                        Self::inspect_log_line(&inner_out, &app_out, &line).await;
                    }
                });
            }

            let log_file_path_stderr = log_file_path.clone();
            let app_err = app_clone.clone();
            let inner_err = inner_clone.clone();

            if let Some(stderr) = stderr {
                tauri::async_runtime::spawn(async move {
                    let mut reader = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        Self::write_log_line(&log_file_path_stderr, &line);
                        Self::inspect_log_line(&inner_err, &app_err, &line).await;
                    }
                });
            }

            let status = child.wait().await;
            log::info!("frpc process exited: {:?}", status);

            let is_err_exit = match &status {
                Ok(s) => !s.success(),
                Err(_) => true,
            };

            running_flag_clone.store(false, Ordering::SeqCst);
            let conn_err = {
                let mut state = inner_clone.lock().await;
                state.child_pid = None;
                state.last_start_time = -1;
                if is_err_exit && state.connection_error.is_none() {
                    state.connection_error = Some("frpc 异常退出，请查看日志".to_string());
                }
                state.connection_error.clone()
            };

            let final_status = FrpcProcessStatus {
                running: false,
                connection_error: conn_err,
                last_start_time: None,
            };
            let _ = app_clone.emit("frpcProcess:watchFrpcLog", ApiResponse::success(final_status));
        });

        Ok(())
    }

    pub async fn terminate(&self, app: AppHandle) -> anyhow::Result<()> {
        let pid = {
            let state = self.inner.lock().await;
            state.child_pid
        };

        if let Some(pid) = pid {
            Self::kill_process_tree(pid);
        }

        self.is_running_flag.store(false, Ordering::SeqCst);
        {
            let mut state = self.inner.lock().await;
            state.child_pid = None;
            state.last_start_time = -1;
            state.connection_error = None;
        }

        let final_status = FrpcProcessStatus {
            running: false,
            connection_error: None,
            last_start_time: None,
        };
        let _ = app.emit("frpcProcess:watchFrpcLog", ApiResponse::success(final_status));

        Ok(())
    }

    fn write_log_line(path: &Path, line: &str) {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(f, "{}", line);
        }
    }

    async fn inspect_log_line(
        inner: &Arc<Mutex<ProcessState>>,
        app: &AppHandle,
        line: &str,
    ) {
        let is_error = line.contains("connect to server error")
            || line.contains("login to server failed")
            || line.contains("address already in use")
            || line.contains("bind: address already in use")
            || line.contains("port already in use");
        let is_success = line.contains("login to server success")
            || line.contains("start proxy success")
            || line.contains("proxy added success")
            || line.contains("proxy added:");

        if is_error {
            let mut state = inner.lock().await;
            state.connection_error = Some(line.to_string());
            let status = FrpcProcessStatus {
                running: true,
                connection_error: Some(line.to_string()),
                last_start_time: Some(state.last_start_time),
            };
            let _ = app.emit("frpcProcess:watchFrpcLog", ApiResponse::success(status));
        } else if is_success {
            let mut state = inner.lock().await;
            if state.connection_error.is_some() {
                state.connection_error = None;
                let status = FrpcProcessStatus {
                    running: true,
                    connection_error: None,
                    last_start_time: Some(state.last_start_time),
                };
                let _ = app.emit("frpcProcess:watchFrpcLog", ApiResponse::success(status));
            }
        }
    }

    fn kill_process_tree(pid: u32) {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }

        #[cfg(not(target_os = "windows"))]
        {
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
                std::thread::sleep(std::time::Duration::from_millis(200));
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }
    }
}

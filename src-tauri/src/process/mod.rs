//! Tool-agnostic supervision of tunnel processes. Providers (frpc, later
//! cloudflared, ...) describe *what* to run via [`LaunchSpec`] and how to read
//! its output via a [`LogClassifier`]; this module owns spawning, log capture,
//! exit tracking, status events and process-tree termination.

use crate::models::{ApiResponse, TunnelStatus};
use std::collections::HashMap;
use std::ffi::OsString;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

pub const TUNNEL_STATUS_CHANNEL: &str = "tunnel:status";

pub struct LaunchSpec {
    pub binary: PathBuf,
    pub args: Vec<OsString>,
    /// Secrets such as tokens go here instead of `args` so they do not show
    /// up in process listings.
    pub envs: Vec<(String, String)>,
    pub log_path: PathBuf,
}

pub enum LogSignal {
    Connected,
    Error,
    None,
}

pub type LogClassifier = fn(&str) -> LogSignal;

struct InstanceState {
    provider: String,
    child_pid: Option<u32>,
    running: bool,
    last_start_time: i64,
    connection_error: Option<String>,
    /// Incremented on every start so a late exit of a previous process does
    /// not overwrite the state of the current one.
    generation: u64,
}

impl InstanceState {
    fn to_status(&self, tunnel_id: &str) -> TunnelStatus {
        TunnelStatus {
            tunnel_id: tunnel_id.to_string(),
            provider: self.provider.clone(),
            running: self.running,
            connection_error: self.connection_error.clone(),
            last_start_time: if self.running && self.last_start_time > 0 {
                Some(self.last_start_time)
            } else {
                None
            },
        }
    }
}

#[derive(Clone)]
pub struct RuntimeManager {
    instances: Arc<Mutex<HashMap<String, InstanceState>>>,
}

impl RuntimeManager {
    pub fn new() -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn is_running(&self, tunnel_id: &str) -> bool {
        let instances = self.instances.lock().await;
        instances.get(tunnel_id).map_or(false, |s| s.running)
    }

    pub async fn running_ids(&self) -> Vec<String> {
        let instances = self.instances.lock().await;
        instances
            .iter()
            .filter(|(_, s)| s.running)
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub async fn get_status(&self, tunnel_id: &str, provider: &str) -> TunnelStatus {
        let instances = self.instances.lock().await;
        match instances.get(tunnel_id) {
            Some(state) => state.to_status(tunnel_id),
            None => TunnelStatus {
                tunnel_id: tunnel_id.to_string(),
                provider: provider.to_string(),
                running: false,
                connection_error: None,
                last_start_time: None,
            },
        }
    }

    pub async fn get_statuses(&self) -> Vec<TunnelStatus> {
        let instances = self.instances.lock().await;
        instances.iter().map(|(id, s)| s.to_status(id)).collect()
    }

    pub async fn start(
        &self,
        app: AppHandle,
        tunnel_id: &str,
        provider: &str,
        spec: LaunchSpec,
        classify: LogClassifier,
    ) -> anyhow::Result<TunnelStatus> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as i64;

        // Hold the lock across spawn so two concurrent starts of the same
        // tunnel cannot both launch a process.
        let mut instances = self.instances.lock().await;
        if let Some(state) = instances.get(tunnel_id) {
            if state.running {
                return Ok(state.to_status(tunnel_id));
            }
        }

        let mut cmd = Command::new(&spec.binary);
        cmd.args(&spec.args);
        cmd.envs(spec.envs.iter().map(|(k, v)| (k.as_str(), v.as_str())));
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn()?;
        let pid = child.id().unwrap_or(0);

        let generation = instances.get(tunnel_id).map_or(0, |s| s.generation) + 1;
        let state = InstanceState {
            provider: provider.to_string(),
            child_pid: Some(pid),
            running: true,
            last_start_time: now,
            connection_error: None,
            generation,
        };
        let status = state.to_status(tunnel_id);
        instances.insert(tunnel_id.to_string(), state);
        drop(instances);

        let _ = app.emit(TUNNEL_STATUS_CHANNEL, ApiResponse::success(status.clone()));

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        if let Some(stdout) = stdout {
            self.spawn_log_pump(
                app.clone(),
                tunnel_id,
                generation,
                spec.log_path.clone(),
                classify,
                BufReader::new(stdout).lines(),
            );
        }
        if let Some(stderr) = stderr {
            self.spawn_log_pump(
                app.clone(),
                tunnel_id,
                generation,
                spec.log_path.clone(),
                classify,
                BufReader::new(stderr).lines(),
            );
        }

        let instances = self.instances.clone();
        let id = tunnel_id.to_string();
        tauri::async_runtime::spawn(async move {
            let exit = child.wait().await;
            log::info!("tunnel {} process exited: {:?}", id, exit);
            let is_err_exit = !matches!(&exit, Ok(s) if s.success());

            let status = {
                let mut instances = instances.lock().await;
                let Some(state) = instances.get_mut(&id) else {
                    return;
                };
                if state.generation != generation || !state.running {
                    // Stopped on purpose or already replaced by a new start.
                    return;
                }
                state.running = false;
                state.child_pid = None;
                state.last_start_time = -1;
                if is_err_exit && state.connection_error.is_none() {
                    state.connection_error = Some("进程异常退出，请查看日志".to_string());
                }
                state.to_status(&id)
            };
            let _ = app.emit(TUNNEL_STATUS_CHANNEL, ApiResponse::success(status));
        });

        Ok(status)
    }

    fn spawn_log_pump<R>(
        &self,
        app: AppHandle,
        tunnel_id: &str,
        generation: u64,
        log_path: PathBuf,
        classify: LogClassifier,
        mut lines: tokio::io::Lines<BufReader<R>>,
    ) where
        R: tokio::io::AsyncRead + Unpin + Send + 'static,
    {
        let instances = self.instances.clone();
        let id = tunnel_id.to_string();
        tauri::async_runtime::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                Self::write_log_line(&log_path, &line);
                let signal = classify(&line);
                if matches!(signal, LogSignal::None) {
                    continue;
                }
                let status = {
                    let mut instances = instances.lock().await;
                    let Some(state) = instances.get_mut(&id) else {
                        continue;
                    };
                    if state.generation != generation || !state.running {
                        continue;
                    }
                    match signal {
                        LogSignal::Error => state.connection_error = Some(line.clone()),
                        LogSignal::Connected if state.connection_error.is_some() => {
                            state.connection_error = None
                        }
                        _ => continue,
                    }
                    state.to_status(&id)
                };
                let _ = app.emit(TUNNEL_STATUS_CHANNEL, ApiResponse::success(status));
            }
        });
    }

    pub async fn stop(&self, app: &AppHandle, tunnel_id: &str) {
        let (pid, status) = {
            let mut instances = self.instances.lock().await;
            let Some(state) = instances.get_mut(tunnel_id) else {
                return;
            };
            let pid = state.child_pid.take();
            state.running = false;
            state.last_start_time = -1;
            state.connection_error = None;
            (pid, state.to_status(tunnel_id))
        };
        if let Some(pid) = pid {
            let _ = tokio::task::spawn_blocking(move || Self::kill_process_tree(pid)).await;
        }
        let _ = app.emit(TUNNEL_STATUS_CHANNEL, ApiResponse::success(status));
    }

    pub async fn stop_all(&self, app: &AppHandle) {
        for id in self.running_ids().await {
            self.stop(app, &id).await;
        }
    }

    /// Drops the runtime entry of a deleted tunnel (stop it first).
    pub async fn forget(&self, tunnel_id: &str) {
        self.instances.lock().await.remove(tunnel_id);
    }

    fn write_log_line(path: &Path, line: &str) {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(f, "{}", line);
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

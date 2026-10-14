pub mod detector;
pub use detector::{DetectFrpcResult, FrpcDetector};

use crate::models::{ApiResponse, SystemMemoryUsage, SystemUsage};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub struct SystemService;

impl SystemService {
    pub fn start_usage_poller(app: AppHandle) {
        tauri::async_runtime::spawn(async move {
            let sys = Arc::new(Mutex::new(System::new_all()));
            loop {
                tokio::time::sleep(Duration::from_secs(3)).await;
                let mut system = sys.lock().await;
                system.refresh_cpu_usage();
                system.refresh_memory();

                let cpu = system.global_cpu_usage();
                let total_mem = system.total_memory();
                let used_mem = system.used_memory();
                let percentage = if total_mem > 0 {
                    (used_mem as f32 / total_mem as f32) * 100.0
                } else {
                    0.0
                };

                let usage = SystemUsage {
                    cpu,
                    memory: SystemMemoryUsage {
                        used: used_mem / (1024 * 1024), // MB
                        percentage,
                    },
                };

                let _ = app.emit("system:watchSystemUsage", ApiResponse::success(usage));
            }
        });
    }

    pub fn open_url(url: &str) -> anyhow::Result<()> {
        open::that(url)?;
        Ok(())
    }

    pub fn open_path<P: AsRef<Path>>(path: P) -> anyhow::Result<()> {
        open::that(path.as_ref())?;
        Ok(())
    }

    pub fn read_log_tail<P: AsRef<Path>>(path: P, max_lines: usize) -> Vec<String> {
        let path = path.as_ref();
        if !path.exists() {
            return Vec::new();
        }

        if let Ok(file) = File::open(path) {
            let reader = BufReader::new(file);
            let lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
            if lines.len() > max_lines {
                lines[lines.len() - max_lines..].to_vec()
            } else {
                lines
            }
        } else {
            Vec::new()
        }
    }

    pub async fn check_latest_release() -> Option<serde_json::Value> {
        let client = reqwest::Client::builder()
            .user_agent("frpc-desktop/1.2.7")
            .timeout(Duration::from_secs(5))
            .build()
            .ok()?;

        let urls = [
            "https://gh.jwinks.com/api/repos/luckjiawei/frpc-desktop/releases/latest",
            "https://api.github.com/repos/luckjiawei/frpc-desktop/releases/latest",
        ];

        for url in urls {
            if let Ok(resp) = client.get(url).send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<serde_json::Value>().await {
                        return Some(val);
                    }
                }
            }
        }
        None
    }
}

pub mod detector;
pub mod logger;
mod usage;
pub use detector::{DetectFrpcResult, FrpcDetector};

use crate::models::ApiResponse;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use usage::AppUsageSampler;

pub struct SystemService;

impl SystemService {
    pub fn start_usage_poller(app: AppHandle) {
        tauri::async_runtime::spawn_blocking(move || {
            let mut sampler = AppUsageSampler::new();
            loop {
                std::thread::sleep(Duration::from_secs(3));
                let usage = sampler.sample();
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
            .user_agent(concat!("frpc-desktop/", env!("CARGO_PKG_VERSION")))
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

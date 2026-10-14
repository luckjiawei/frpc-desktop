use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    #[serde(rename = "bizCode")]
    pub biz_code: String,
    pub data: Option<T>,
    pub message: String,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            biz_code: "A1000".to_string(),
            data: Some(data),
            message: "successful.".to_string(),
        }
    }

    pub fn fail(biz_code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            biz_code: biz_code.into(),
            data: None,
            message: message.into(),
        }
    }

    pub fn internal_error(message: impl Into<String>) -> Self {
        Self {
            biz_code: "B1000".to_string(),
            data: None,
            message: message.into(),
        }
    }
}

impl ApiResponse<serde_json::Value> {
    pub fn success_empty() -> Self {
        Self {
            biz_code: "A1000".to_string(),
            data: Some(serde_json::Value::Null),
            message: "successful.".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LogConfig {
    #[serde(default)]
    pub to: String,
    #[serde(default = "default_log_level")]
    pub level: String,
    #[serde(default = "default_max_days")]
    pub max_days: i64,
    #[serde(default)]
    pub disable_print_color: bool,
}

fn default_log_level() -> String {
    "info".to_string()
}
fn default_max_days() -> i64 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    #[serde(default)]
    pub method: String,
    #[serde(default)]
    pub token: String,
}

fn default_web_enable() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebServerConfig {
    #[serde(default = "default_web_enable")]
    pub enable: bool,
    #[serde(default)]
    pub addr: String,
    #[serde(default)]
    pub port: i64,
    #[serde(default)]
    pub user: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub pprof_enable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TransportTlsConfig {
    #[serde(default)]
    pub enable: bool,
    #[serde(default)]
    pub cert_file: String,
    #[serde(default)]
    pub key_file: String,
    #[serde(default)]
    pub trusted_ca_file: String,
    #[serde(default)]
    pub server_name: String,
    #[serde(default)]
    pub disable_custom_tls_first_byte: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TransportConfig {
    #[serde(default = "default_dial_timeout")]
    pub dial_server_timeout: i64,
    #[serde(default = "default_dial_keepalive")]
    pub dial_server_keepalive: i64,
    #[serde(default)]
    pub pool_count: i64,
    #[serde(default = "default_true")]
    pub tcp_mux: bool,
    #[serde(default = "default_mux_interval")]
    pub tcp_mux_keepalive_interval: i64,
    #[serde(default = "default_protocol")]
    pub protocol: String,
    #[serde(default)]
    pub connect_server_local_ip: String,
    #[serde(default)]
    pub proxy_url: String,
    #[serde(default)]
    pub tls: TransportTlsConfig,
    #[serde(default)]
    pub heartbeat_interval: i64,
    #[serde(default)]
    pub heartbeat_timeout: i64,
}

fn default_dial_timeout() -> i64 {
    10
}
fn default_dial_keepalive() -> i64 {
    7200
}
fn default_mux_interval() -> i64 {
    30
}
fn default_true() -> bool {
    true
}
fn default_protocol() -> String {
    "tcp".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrpcSystemConfiguration {
    #[serde(default)]
    pub launch_at_startup: bool,
    #[serde(default)]
    pub silent_startup: bool,
    #[serde(default)]
    pub auto_connect_on_startup: bool,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_language() -> String {
    "en-US".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OpenSourceFrpcDesktopServer {
    #[serde(rename = "_id", default = "default_server_id")]
    pub id: String,
    #[serde(default)]
    pub frpc_version: Option<i64>,
    #[serde(default)]
    pub custom_frpc_path: String,
    #[serde(default)]
    pub multiuser: bool,
    #[serde(default)]
    pub user: String,
    #[serde(default)]
    pub server_addr: String,
    #[serde(default = "default_server_port")]
    pub server_port: i64,
    #[serde(default)]
    pub login_fail_exit: bool,
    #[serde(default = "default_udp_packet_size")]
    pub udp_packet_size: i64,
    #[serde(default)]
    pub auth: AuthConfig,
    #[serde(default)]
    pub log: LogConfig,
    #[serde(default)]
    pub web_server: WebServerConfig,
    #[serde(default)]
    pub transport: TransportConfig,
    #[serde(default)]
    pub metadatas: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub system: FrpcSystemConfiguration,
}

fn default_server_id() -> String {
    "1".to_string()
}
fn default_server_port() -> i64 {
    7000
}
fn default_udp_packet_size() -> i64 {
    1500
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrpcProxyTransportConfig {
    #[serde(default)]
    pub use_encryption: bool,
    #[serde(default)]
    pub use_compression: bool,
    #[serde(default)]
    pub proxy_protocol_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrpcProxy {
    #[serde(rename = "_id", default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(rename = "type")]
    pub proxy_type: String,
    #[serde(rename = "localIP", default)]
    pub local_ip: String,
    #[serde(default)]
    pub local_port: serde_json::Value,
    #[serde(default)]
    pub remote_port: serde_json::Value,
    #[serde(default)]
    pub custom_domains: Vec<String>,
    #[serde(default)]
    pub locations: Vec<String>,
    #[serde(default)]
    pub host_header_rewrite: String,
    #[serde(default = "default_visitors_model")]
    pub visitors_model: String,
    #[serde(default)]
    pub server_user: String,
    #[serde(default)]
    pub server_name: String,
    #[serde(default)]
    pub secret_key: String,
    #[serde(default)]
    pub bind_addr: String,
    #[serde(default)]
    pub bind_port: Option<i64>,
    #[serde(default)]
    pub subdomain: String,
    #[serde(default)]
    pub basic_auth: bool,
    #[serde(default)]
    pub http_user: String,
    #[serde(default)]
    pub http_password: String,
    #[serde(default)]
    pub fallback_to: String,
    #[serde(default = "default_fallback_timeout")]
    pub fallback_timeout_ms: i64,
    #[serde(default)]
    pub https2http: bool,
    #[serde(default)]
    pub https2http_ca_file: String,
    #[serde(default)]
    pub https2http_key_file: String,
    #[serde(default)]
    pub tls2raw: bool,
    #[serde(default)]
    pub tls2raw_ca_file: String,
    #[serde(default)]
    pub tls2raw_key_file: String,
    #[serde(default)]
    pub keep_tunnel_open: bool,
    #[serde(default = "default_proxy_status")]
    pub status: i64,
    #[serde(default)]
    pub transport: FrpcProxyTransportConfig,
}

fn default_visitors_model() -> String {
    "visitors".to_string()
}
fn default_fallback_timeout() -> i64 {
    500
}
fn default_proxy_status() -> i64 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrpcVersion {
    #[serde(rename = "_id", default)]
    pub id: String,
    pub github_release_id: i64,
    pub github_asset_id: i64,
    pub github_created_at: String,
    pub name: String,
    pub asset_name: String,
    #[serde(default)]
    pub version_download_count: i64,
    #[serde(default)]
    pub asset_download_count: i64,
    pub browser_download_url: String,
    #[serde(default = "default_true")]
    pub downloaded: bool,
    #[serde(default)]
    pub local_path: Option<String>,
    #[serde(default)]
    pub size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubAsset {
    pub id: i64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub size: i64,
    #[serde(default)]
    pub download_count: i64,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub browser_download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubRelease {
    pub id: i64,
    #[serde(default)]
    pub name: String,
    pub tag_name: Option<String>,
    pub body: Option<String>,
    pub html_url: Option<String>,
    #[serde(default)]
    pub assets: Vec<GithubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrpcProcessStatus {
    pub running: bool,
    pub connection_error: Option<String>,
    pub last_start_time: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMemoryUsage {
    pub used: u64,
    pub percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemUsage {
    pub cpu: f32,
    pub memory: SystemMemoryUsage,
}

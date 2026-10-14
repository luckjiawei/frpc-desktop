use crate::config_gen::ConfigGenerator;
use crate::db::app_config_repo::AppConfigRepository;
use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::db::tunnel_repo::{TunnelRepository, DEFAULT_TUNNEL_ID, MAX_TUNNEL_NAME_LEN};
use crate::db::version_repo::VersionRepository;
use crate::db::DbManager;
use crate::downloader::VersionManager;
use crate::models::{
    ApiResponse, FrpcProxy, FrpcSystemConfiguration, OpenSourceFrpcDesktopServer, TunnelStatus,
};
use crate::process::RuntimeManager;
use crate::providers::{provider_for, TunnelContext};
use crate::system::{FrpcDetector, SystemService};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub db: DbManager,
    pub runtime: RuntimeManager,
    pub version_mgr: VersionManager,
    pub app_data_dir: PathBuf,
    pub config_dir: PathBuf,
    pub log_dir: PathBuf,
    pub app_log_path: PathBuf,
}

/// Per-tunnel files. The default tunnel keeps the 1.x/2.0 locations so
/// existing logs stay visible after the upgrade.
pub struct TunnelPaths {
    pub config_path: PathBuf,
    pub log_path: PathBuf,
}

impl AppState {
    /// `tunnel_id` must be validated with `TunnelRepository::is_valid_id`.
    pub fn tunnel_paths(&self, tunnel_id: &str) -> TunnelPaths {
        if tunnel_id == DEFAULT_TUNNEL_ID {
            TunnelPaths {
                config_path: self.config_dir.join("frpc.toml"),
                log_path: self.log_dir.join("frpc.log"),
            }
        } else {
            TunnelPaths {
                config_path: self.config_dir.join("tunnels").join(tunnel_id).join("frpc.toml"),
                log_path: self.log_dir.join("tunnels").join(tunnel_id).join("frpc.log"),
            }
        }
    }

    fn remove_tunnel_files(&self, tunnel_id: &str) {
        if tunnel_id == DEFAULT_TUNNEL_ID || !TunnelRepository::is_valid_id(tunnel_id) {
            return;
        }
        let _ = fs::remove_dir_all(self.config_dir.join("tunnels").join(tunnel_id));
        let _ = fs::remove_dir_all(self.log_dir.join("tunnels").join(tunnel_id));
    }

    pub async fn launch_tunnel(
        &self,
        app: &AppHandle,
        tunnel_id: &str,
    ) -> Result<TunnelStatus, (String, String)> {
        if !TunnelRepository::is_valid_id(tunnel_id) {
            return Err(("B1008".to_string(), "Tunnel not found".to_string()));
        }
        let tunnel = {
            let conn = self.db.conn();
            if tunnel_id == DEFAULT_TUNNEL_ID {
                TunnelRepository::ensure_default(&conn)
                    .map_err(|e| ("B1000".to_string(), e.to_string()))?;
            }
            TunnelRepository::find(&conn, tunnel_id)
                .map_err(|e| ("B1000".to_string(), e.to_string()))?
                .ok_or(("B1008".to_string(), "Tunnel not found".to_string()))?
        };
        if self.runtime.is_running(tunnel_id).await {
            return Ok(self.runtime.get_status(tunnel_id, &tunnel.provider).await);
        }
        let provider = provider_for(&tunnel.provider).ok_or((
            "B1000".to_string(),
            format!("Unsupported provider: {}", tunnel.provider),
        ))?;
        let paths = self.tunnel_paths(tunnel_id);
        let spec = provider.prepare(&TunnelContext {
            db: &self.db,
            tunnel: &tunnel,
            config_path: &paths.config_path,
            log_path: &paths.log_path,
        })?;
        self.runtime
            .start(
                app.clone(),
                tunnel_id,
                &tunnel.provider,
                spec,
                provider.log_classifier(),
            )
            .await
            .map_err(|e| ("B1000".to_string(), e.to_string()))
    }

    /// Starts every tunnel (or only those marked `auto_start`); failures are
    /// reported per tunnel and do not stop the others.
    pub async fn launch_all(
        &self,
        app: &AppHandle,
        only_auto_start: bool,
    ) -> Vec<Result<TunnelStatus, (String, String, String)>> {
        let tunnels = {
            let conn = self.db.conn();
            TunnelRepository::list(&conn).unwrap_or_default()
        };
        let mut results = Vec::new();
        for tunnel in tunnels {
            if only_auto_start && !tunnel.auto_start {
                continue;
            }
            results.push(
                self.launch_tunnel(app, &tunnel.id)
                    .await
                    .map_err(|(code, msg)| (tunnel.id.clone(), code, msg)),
            );
        }
        results
    }

    pub async fn all_statuses(&self) -> Vec<TunnelStatus> {
        let tunnels = {
            let conn = self.db.conn();
            TunnelRepository::list(&conn).unwrap_or_default()
        };
        let mut statuses = Vec::with_capacity(tunnels.len());
        for tunnel in tunnels {
            statuses.push(self.runtime.get_status(&tunnel.id, &tunnel.provider).await);
        }
        statuses
    }
}

/// Reads `tunnelId` from object args, defaulting to the default tunnel so
/// callers written for the single-server era keep working.
fn arg_tunnel_id(args: &Option<Value>) -> Result<String, ApiResponse<Value>> {
    let id = args
        .as_ref()
        .and_then(|v| v.get("tunnelId"))
        .and_then(|v| v.as_str())
        .unwrap_or(DEFAULT_TUNNEL_ID)
        .to_string();
    if TunnelRepository::is_valid_id(&id) {
        Ok(id)
    } else {
        Err(ApiResponse::fail("B1008", "Tunnel not found"))
    }
}

fn arg_tunnel_name(args: &Option<Value>) -> Result<Option<String>, ApiResponse<Value>> {
    match args.as_ref().and_then(|v| v.get("name")).and_then(|v| v.as_str()) {
        None => Ok(None),
        Some(raw) => {
            let name = raw.trim();
            if name.is_empty() || name.chars().count() > MAX_TUNNEL_NAME_LEN {
                Err(ApiResponse::fail("B1000", "Invalid tunnel name"))
            } else {
                Ok(Some(name.to_string()))
            }
        }
    }
}

macro_rules! tunnel_id_or_return {
    ($args:expr) => {
        match arg_tunnel_id(&$args) {
            Ok(id) => id,
            Err(resp) => return resp,
        }
    };
}

#[tauri::command]
pub async fn ipc_send(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    args: Option<Value>,
) -> Result<ApiResponse<Value>, String> {
    let result = handle_ipc_send(&app, &state, &path, args).await;
    Ok(result)
}

async fn handle_ipc_send(
    app: &AppHandle,
    state: &AppState,
    path: &str,
    args: Option<Value>,
) -> ApiResponse<Value> {
    match path {
        // --- SERVER ---
        "server/getServerConfig" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let conn = state.db.conn();
            match ServerRepository::get_server_config(&conn, &tunnel_id) {
                Ok(cfg) => ApiResponse::success(serde_json::to_value(cfg).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        // Saves only the tunnel's frpc settings; desktop settings are saved
        // through system/saveSystemConfig.
        "server/saveConfig" => {
            if let Some(val) = args {
                match serde_json::from_value::<OpenSourceFrpcDesktopServer>(val) {
                    Ok(server) => {
                        if !TunnelRepository::is_valid_id(&server.id) {
                            return ApiResponse::fail("B1008", "Tunnel not found");
                        }
                        let conn = state.db.conn();
                        if server.id == DEFAULT_TUNNEL_ID {
                            if let Err(e) = TunnelRepository::ensure_default(&conn) {
                                return ApiResponse::internal_error(e.to_string());
                            }
                        } else if !matches!(TunnelRepository::find(&conn, &server.id), Ok(Some(_))) {
                            return ApiResponse::fail("B1008", "Tunnel not found");
                        }
                        match ServerRepository::save_frpc_settings(&conn, &server) {
                            Ok(()) => ApiResponse::success(serde_json::to_value(&server).unwrap_or(Value::Null)),
                            Err(e) => ApiResponse::internal_error(e.to_string()),
                        }
                    }
                    Err(e) => ApiResponse::internal_error(format!("Invalid server payload: {}", e)),
                }
            } else {
                ApiResponse::internal_error("Missing arguments for saveConfig")
            }
        }
        "server/resetAllConfig" => {
            state.runtime.stop_all(app).await;
            let removed: Vec<String> = {
                let conn = state.db.conn();
                TunnelRepository::list(&conn)
                    .unwrap_or_default()
                    .into_iter()
                    .map(|t| t.id)
                    .filter(|id| id != DEFAULT_TUNNEL_ID)
                    .collect()
            };
            let conn = state.db.conn();
            match ServerRepository::reset_all_config(&conn) {
                Ok(()) => {
                    for id in &removed {
                        state.remove_tunnel_files(id);
                    }
                    match ServerRepository::get_server_config(&conn, DEFAULT_TUNNEL_ID) {
                        Ok(server) => {
                            ApiResponse::success(serde_json::to_value(server).unwrap_or(Value::Null))
                        }
                        Err(e) => ApiResponse::internal_error(e.to_string()),
                    }
                }
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "server/exportConfig" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let conn = state.db.conn();
            let server = match ServerRepository::get_server_config(&conn, &tunnel_id) {
                Ok(s) => s,
                Err(e) => return ApiResponse::internal_error(e.to_string()),
            };
            let proxies = match ProxyRepository::get_proxies_by_server(&conn, &tunnel_id) {
                Ok(p) => p,
                Err(e) => return ApiResponse::internal_error(e.to_string()),
            };
            drop(conn);
            let log_path = state.tunnel_paths(&tunnel_id).log_path;
            let toml_str = ConfigGenerator::gen_toml_config(&server, &proxies, &log_path);

            if let Some(path_buf) = rfd::FileDialog::new()
                .set_file_name("frpc.toml")
                .add_filter("TOML Config", &["toml"])
                .save_file()
            {
                if let Err(e) = fs::write(&path_buf, &toml_str) {
                    return ApiResponse::internal_error(format!("Failed to write file: {}", e));
                }
                ApiResponse::success(serde_json::json!({
                    "canceled": false,
                    "path": path_buf.to_string_lossy()
                }))
            } else {
                ApiResponse::success(serde_json::json!({
                    "canceled": true,
                    "path": ""
                }))
            }
        }
        "server/importTomlConfig" => {
            if let Some(path_buf) = rfd::FileDialog::new()
                .add_filter("TOML Config", &["toml"])
                .pick_file()
            {
                match fs::read_to_string(&path_buf) {
                    Ok(_content) => {
                        // Import TOML
                        ApiResponse::success(serde_json::json!({
                            "canceled": false,
                            "path": path_buf.to_string_lossy()
                        }))
                    }
                    Err(e) => ApiResponse::internal_error(format!("Failed to read file: {}", e)),
                }
            } else {
                ApiResponse::success(serde_json::json!({
                    "canceled": true,
                    "path": ""
                }))
            }
        }
        "system/getSystemConfig" => {
            let conn = state.db.conn();
            match AppConfigRepository::get_system_config(&conn) {
                Ok(sys) => ApiResponse::success(serde_json::to_value(sys).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "system/saveSystemConfig" => {
            let Some(val) = args else {
                return ApiResponse::internal_error("Missing arguments for saveSystemConfig");
            };
            let config = match serde_json::from_value::<FrpcSystemConfiguration>(val) {
                Ok(c) => c,
                Err(e) => return ApiResponse::internal_error(format!("Invalid system payload: {}", e)),
            };
            if !matches!(config.language.as_str(), "zh-CN" | "en-US") {
                return ApiResponse::fail("B1000", "Invalid language");
            }
            let conn = state.db.conn();
            match AppConfigRepository::save_system_config(&conn, &config) {
                Ok(()) => {
                    use tauri_plugin_autostart::ManagerExt;
                    if config.launch_at_startup {
                        let _ = app.autolaunch().enable();
                    } else {
                        let _ = app.autolaunch().disable();
                    }
                    ApiResponse::success(serde_json::to_value(&config).unwrap_or(Value::Null))
                }
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "server/getLanguage" => {
            let conn = state.db.conn();
            match AppConfigRepository::get_system_config(&conn) {
                Ok(sys) => ApiResponse::success(Value::String(sys.language)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "server/saveLanguage" => {
            let lang = match args {
                Some(Value::String(s)) => s,
                Some(Value::Object(map)) => map
                    .get("language")
                    .and_then(|v| v.as_str())
                    .unwrap_or("en-US")
                    .to_string(),
                _ => "en-US".to_string(),
            };
            let conn = state.db.conn();
            match AppConfigRepository::save_language(&conn, &lang) {
                Ok(()) => ApiResponse::success_empty(),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }

        // --- PROXY ---
        "proxy/getAllProxies" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let conn = state.db.conn();
            match ProxyRepository::get_proxies_by_server(&conn, &tunnel_id) {
                Ok(list) => ApiResponse::success(serde_json::to_value(list).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "proxy/createProxy" => {
            if let Some(val) = args {
                match serde_json::from_value::<FrpcProxy>(val) {
                    Ok(proxy) => {
                        if !TunnelRepository::is_valid_id(&proxy.server_id) {
                            return ApiResponse::fail("B1008", "Tunnel not found");
                        }
                        let conn = state.db.conn();
                        match ProxyRepository::create_proxy(&conn, proxy) {
                            Ok(created) => {
                                ApiResponse::success(serde_json::to_value(created).unwrap_or(Value::Null))
                            }
                            Err(e) => ApiResponse::internal_error(e.to_string()),
                        }
                    }
                    Err(e) => ApiResponse::internal_error(format!("Invalid proxy payload: {}", e)),
                }
            } else {
                ApiResponse::internal_error("Missing arguments for createProxy")
            }
        }
        "proxy/modifyProxy" => {
            if let Some(val) = args {
                match serde_json::from_value::<FrpcProxy>(val) {
                    Ok(proxy) => {
                        let conn = state.db.conn();
                        match ProxyRepository::modify_proxy(&conn, proxy) {
                            Ok(updated) => {
                                ApiResponse::success(serde_json::to_value(updated).unwrap_or(Value::Null))
                            }
                            Err(e) => ApiResponse::internal_error(e.to_string()),
                        }
                    }
                    Err(e) => ApiResponse::internal_error(format!("Invalid proxy payload: {}", e)),
                }
            } else {
                ApiResponse::internal_error("Missing arguments for modifyProxy")
            }
        }
        "proxy/deleteProxy" => {
            let proxy_id = match args {
                Some(Value::String(s)) => s,
                Some(Value::Object(map)) => map
                    .get("id")
                    .or_else(|| map.get("_id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                _ => String::new(),
            };
            if proxy_id.is_empty() {
                return ApiResponse::internal_error("Missing proxy id for deleteProxy");
            }
            let conn = state.db.conn();
            match ProxyRepository::delete_proxy(&conn, &proxy_id) {
                Ok(()) => ApiResponse::success_empty(),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "proxy/modifyProxyStatus" => {
            if let Some(Value::Object(map)) = args {
                let id = map
                    .get("id")
                    .or_else(|| map.get("_id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let status = map.get("status").and_then(|v| v.as_i64()).unwrap_or(1);
                let conn = state.db.conn();
                match ProxyRepository::modify_proxy_status(&conn, id, status) {
                    Ok(()) => ApiResponse::success_empty(),
                    Err(e) => ApiResponse::internal_error(e.to_string()),
                }
            } else {
                ApiResponse::internal_error("Invalid payload for modifyProxyStatus")
            }
        }
        "proxy/getLocalPorts" => {
            let conn = state.db.conn();
            match ProxyRepository::get_local_ports(&conn) {
                Ok(ports) => ApiResponse::success(serde_json::to_value(ports).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }

        // --- TUNNEL ---
        "tunnel/list" => {
            let conn = state.db.conn();
            let _ = TunnelRepository::ensure_default(&conn);
            match TunnelRepository::list_summaries(&conn) {
                Ok(list) => ApiResponse::success(serde_json::to_value(list).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "tunnel/create" => {
            let name = match arg_tunnel_name(&args) {
                Ok(Some(name)) => name,
                Ok(None) => return ApiResponse::fail("B1000", "Invalid tunnel name"),
                Err(resp) => return resp,
            };
            let provider = args
                .as_ref()
                .and_then(|v| v.get("provider"))
                .and_then(|v| v.as_str())
                .unwrap_or(crate::db::tunnel_repo::PROVIDER_FRPC)
                .to_string();
            if !TunnelRepository::is_supported_provider(&provider) {
                return ApiResponse::fail("B1000", format!("Unsupported provider: {}", provider));
            }
            let mut conn = state.db.conn();
            match TunnelRepository::create(&mut conn, &name, &provider) {
                Ok(tunnel) => ApiResponse::success(serde_json::to_value(tunnel).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "tunnel/update" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let name = match arg_tunnel_name(&args) {
                Ok(name) => name,
                Err(resp) => return resp,
            };
            let auto_start = args
                .as_ref()
                .and_then(|v| v.get("autoStart"))
                .and_then(|v| v.as_bool());
            let conn = state.db.conn();
            match TunnelRepository::update(&conn, &tunnel_id, name.as_deref(), auto_start) {
                Ok(Some(tunnel)) => ApiResponse::success(serde_json::to_value(tunnel).unwrap_or(Value::Null)),
                Ok(None) => ApiResponse::fail("B1008", "Tunnel not found"),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "tunnel/delete" => {
            let tunnel_id = tunnel_id_or_return!(args);
            if tunnel_id == DEFAULT_TUNNEL_ID {
                return ApiResponse::fail("B1009", "The default tunnel cannot be deleted");
            }
            state.runtime.stop(app, &tunnel_id).await;
            let deleted = {
                let conn = state.db.conn();
                TunnelRepository::delete(&conn, &tunnel_id)
            };
            match deleted {
                Ok(true) => {
                    state.runtime.forget(&tunnel_id).await;
                    state.remove_tunnel_files(&tunnel_id);
                    ApiResponse::success(serde_json::json!({ "tunnelId": tunnel_id }))
                }
                Ok(false) => ApiResponse::fail("B1008", "Tunnel not found"),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }

        // --- LAUNCH ---
        "launch/getStatus" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let provider = {
                let conn = state.db.conn();
                TunnelRepository::find(&conn, &tunnel_id)
                    .ok()
                    .flatten()
                    .map(|t| t.provider)
                    .unwrap_or_else(|| crate::db::tunnel_repo::PROVIDER_FRPC.to_string())
            };
            let status = state.runtime.get_status(&tunnel_id, &provider).await;
            ApiResponse::success(serde_json::to_value(status).unwrap_or(Value::Null))
        }
        "launch/getStatuses" => {
            let statuses = state.all_statuses().await;
            ApiResponse::success(serde_json::to_value(statuses).unwrap_or(Value::Null))
        }
        "launch/terminate" => {
            let tunnel_id = tunnel_id_or_return!(args);
            state.runtime.stop(app, &tunnel_id).await;
            ApiResponse::success(serde_json::json!({ "tunnelId": tunnel_id }))
        }
        "launch/launch" => {
            let tunnel_id = tunnel_id_or_return!(args);
            match state.launch_tunnel(app, &tunnel_id).await {
                Ok(status) => ApiResponse::success(serde_json::to_value(status).unwrap_or(Value::Null)),
                Err((code, msg)) => {
                    ApiResponse::fail_with_data(code, msg, serde_json::json!({ "tunnelId": tunnel_id }))
                }
            }
        }
        "launch/launchAll" => {
            let failures: Vec<Value> = state
                .launch_all(app, false)
                .await
                .into_iter()
                .filter_map(|r| r.err())
                .map(|(tunnel_id, code, message)| {
                    serde_json::json!({ "tunnelId": tunnel_id, "bizCode": code, "message": message })
                })
                .collect();
            ApiResponse::success(serde_json::json!({ "failures": failures }))
        }
        "launch/terminateAll" => {
            state.runtime.stop_all(app).await;
            ApiResponse::success_empty()
        }

        // --- VERSION ---
        "version/getVersions" => {
            let versions = state.version_mgr.get_all_catalog_versions(&state.db).await;
            ApiResponse::success(serde_json::to_value(versions).unwrap_or(Value::Null))
        }
        "version/getDownloadedVersions" => {
            let conn = state.db.conn();
            match VersionRepository::get_downloaded_versions(&conn) {
                Ok(list) => ApiResponse::success(serde_json::to_value(list).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "version/downloadVersion" => {
            let (rel_id, mirror) = match args {
                Some(Value::Object(ref map)) => {
                    let id = map
                        .get("githubReleaseId")
                        .or_else(|| map.get("version"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let mirror = map
                        .get("mirrorId")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    (id, mirror)
                }
                Some(Value::Number(n)) => (n.as_i64().unwrap_or(0), None),
                _ => (0, None),
            };

            if rel_id <= 0 {
                return ApiResponse::internal_error("Invalid release ID");
            }

            let app_handle = app.clone();
            let res = state
                .version_mgr
                .download_version(&state.db, rel_id, mirror, move |percent| {
                    let _ = app_handle.emit(
                        "version/downloadVersion:hook",
                        ApiResponse::success(serde_json::json!({
                            "completed": false,
                            "percent": percent,
                            "githubReleaseId": rel_id
                        })),
                    );
                })
                .await;

            match res {
                Ok(_ver) => {
                    let resp_payload = serde_json::json!({
                        "completed": true,
                        "percent": 1.0,
                        "githubReleaseId": rel_id
                    });
                    let _ = app.emit(
                        "version/downloadVersion:hook",
                        ApiResponse::success(resp_payload.clone()),
                    );
                    ApiResponse::success(resp_payload)
                }
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "version/deleteDownloadedVersion" => {
            let rel_id = match args {
                Some(Value::Object(ref map)) => map
                    .get("githubReleaseId")
                    .or_else(|| map.get("version"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
                Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
                _ => 0,
            };
            if rel_id <= 0 {
                return ApiResponse::internal_error("Invalid release ID");
            }
            let conn = state.db.conn();
            match state.version_mgr.delete_version(&conn, rel_id) {
                Ok(()) => ApiResponse::success_empty(),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "version/importLocalFrpcVersion" => {
            let path_str = match args {
                Some(Value::Object(ref map)) => map
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                Some(Value::String(ref s)) => s.clone(),
                _ => String::new(),
            };

            let picked_path = if !path_str.trim().is_empty() {
                Some(PathBuf::from(path_str))
            } else {
                rfd::FileDialog::new()
                    .add_filter("Frpc Archive", &["tar.gz", "zip", "gz"])
                    .pick_file()
            };

            match picked_path {
                Some(path_buf) => {
                    match state.version_mgr.import_local_file(&state.db, &path_buf).await {
                        Ok(_) => ApiResponse::success(serde_json::json!({ "canceled": false })),
                        Err(e) => {
                            let msg = e.to_string();
                            if msg.starts_with("B1002:") {
                                ApiResponse::fail("B1002", msg.trim_start_matches("B1002:"))
                            } else if msg.starts_with("B1003:") {
                                ApiResponse::fail("B1003", msg.trim_start_matches("B1003:"))
                            } else if msg.starts_with("B1004:") {
                                ApiResponse::fail("B1004", msg.trim_start_matches("B1004:"))
                            } else {
                                ApiResponse::fail("B1000", msg)
                            }
                        }
                    }
                }
                None => ApiResponse::success(serde_json::json!({ "canceled": true })),
            }
        }
        "version/detectFrpcPath" => {
            let res = FrpcDetector::detect();
            ApiResponse::success(serde_json::to_value(res).unwrap_or(Value::Null))
        }
        "version/validateFrpcPath" => {
            let path_str = match args {
                Some(Value::Object(map)) => map
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                Some(Value::String(s)) => s,
                _ => String::new(),
            };
            if path_str.trim().is_empty() {
                ApiResponse::success(serde_json::json!({
                    "valid": false,
                    "error": "路径为空"
                }))
            } else {
                match FrpcDetector::validate_path(&path_str) {
                    Ok(ver) => ApiResponse::success(serde_json::json!({
                        "valid": true,
                        "version": ver
                    })),
                    Err(e) => ApiResponse::success(serde_json::json!({
                        "valid": false,
                        "error": e
                    })),
                }
            }
        }

        // --- LOG ---
        "log/getFrpLogContent" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let lines = SystemService::read_log_tail(&state.tunnel_paths(&tunnel_id).log_path, 500);
            ApiResponse::success(Value::String(lines.join("\n")))
        }
        "log/getAppLogContent" => {
            let lines = SystemService::read_log_tail(&state.app_log_path, 500);
            ApiResponse::success(Value::String(lines.join("\n")))
        }
        "log/openFrpcLogFile" => {
            let tunnel_id = tunnel_id_or_return!(args);
            let _ = SystemService::open_path(&state.tunnel_paths(&tunnel_id).log_path);
            ApiResponse::success_empty()
        }
        "log/openAppLogFile" => {
            let _ = SystemService::open_path(&state.app_log_path);
            ApiResponse::success_empty()
        }

        // --- SYSTEM ---
        "system/openUrl" => {
            if let Some(Value::Object(map)) = args {
                if let Some(url) = map.get("url").and_then(|v| v.as_str()) {
                    let _ = SystemService::open_url(url);
                }
            }
            ApiResponse::success_empty()
        }
        "system/relaunchApp" => {
            app.restart();
        }
        "server/getTheme" => {
            let conn = state.db.conn();
            match AppConfigRepository::get_theme(&conn) {
                Ok(theme) => ApiResponse::success(Value::String(theme)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "server/saveTheme" => {
            let theme = match args {
                Some(Value::String(s)) => s,
                Some(Value::Object(map)) => map
                    .get("theme")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                _ => String::new(),
            };
            if !AppConfigRepository::is_valid_theme(&theme) {
                return ApiResponse::fail("B1000", "Invalid theme");
            }
            let conn = state.db.conn();
            match AppConfigRepository::save_theme(&conn, &theme) {
                Ok(()) => ApiResponse::success(Value::String(theme)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "system/getGuideStatus" => {
            let conn = state.db.conn();
            match AppConfigRepository::is_guide_completed(&conn) {
                Ok(completed) => ApiResponse::success(Value::Bool(completed)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "system/completeGuide" => {
            let conn = state.db.conn();
            match AppConfigRepository::save_guide_completed(&conn) {
                Ok(()) => ApiResponse::success_empty(),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "system/openAppData" => {
            let _ = SystemService::open_path(&state.app_data_dir);
            ApiResponse::success_empty()
        }
        "system/selectLocalFile" => {
            let mut dialog = rfd::FileDialog::new();
            if let Some(Value::Object(map)) = args {
                let name = map.get("name").and_then(|v| v.as_str()).unwrap_or("");
                if let Some(Value::Array(exts)) = map.get("extensions") {
                    let ext_strs: Vec<&str> =
                        exts.iter().filter_map(|e| e.as_str()).collect();
                    if !ext_strs.is_empty() {
                        dialog = dialog.add_filter(name, &ext_strs);
                    }
                }
            }
            if let Some(path_buf) = dialog.pick_file() {
                ApiResponse::success(serde_json::json!({
                    "canceled": false,
                    "path": path_buf.to_string_lossy()
                }))
            } else {
                ApiResponse::success(serde_json::json!({
                    "canceled": true,
                    "path": ""
                }))
            }
        }
        "system/getFrpcDesktopGithubLastRelease" => {
            let manual = args
                .as_ref()
                .and_then(|v| v.get("manual"))
                .and_then(|m| m.as_bool())
                .unwrap_or(false);

            if let Some(release) = SystemService::check_latest_release().await {
                ApiResponse::success(serde_json::json!({
                    "manual": manual,
                    "version": release
                }))
            } else {
                ApiResponse::success(serde_json::json!({
                    "manual": manual,
                    "version": serde_json::Value::Null
                }))
            }
        }

        unknown => {
            log::warn!("Unhandled IPC path: {}", unknown);
            ApiResponse::internal_error(format!("Unhandled path: {}", unknown))
        }
    }
}

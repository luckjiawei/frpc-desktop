use crate::config_gen::ConfigGenerator;
use crate::db::app_config_repo::AppConfigRepository;
use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::db::version_repo::VersionRepository;
use crate::db::DbManager;
use crate::downloader::VersionManager;
use crate::models::{
    ApiResponse, FrpcProxy, OpenSourceFrpcDesktopServer,
};
use crate::process::ProcessManager;
use crate::system::{FrpcDetector, SystemService};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, State};

pub struct AppState {
    pub db: DbManager,
    pub process_mgr: ProcessManager,
    pub version_mgr: VersionManager,
    pub app_data_dir: PathBuf,
    pub config_path: PathBuf,
    pub frpc_log_path: PathBuf,
    pub app_log_path: PathBuf,
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
            let conn = state.db.conn();
            match ServerRepository::get_server_config(&conn) {
                Ok(cfg) => ApiResponse::success(serde_json::to_value(cfg).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "server/saveConfig" => {
            if let Some(val) = args {
                match serde_json::from_value::<OpenSourceFrpcDesktopServer>(val) {
                    Ok(mut server) => {
                        server.id = "1".to_string();
                        let conn = state.db.conn();
                        match ServerRepository::save_server_config(&conn, &server) {
                            Ok(()) => {
                                ApiResponse::success(serde_json::to_value(&server).unwrap_or(Value::Null))
                            }
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
            let conn = state.db.conn();
            match ServerRepository::reset_all_config(&conn) {
                Ok(()) => {
                    let default_server = ServerRepository::get_server_config(&conn).unwrap();
                    ApiResponse::success(serde_json::to_value(default_server).unwrap_or(Value::Null))
                }
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "server/exportConfig" => {
            let conn = state.db.conn();
            let server = match ServerRepository::get_server_config(&conn) {
                Ok(s) => s,
                Err(e) => return ApiResponse::internal_error(e.to_string()),
            };
            let proxies = match ProxyRepository::get_all_proxies(&conn) {
                Ok(p) => p,
                Err(e) => return ApiResponse::internal_error(e.to_string()),
            };
            let toml_str = ConfigGenerator::gen_toml_config(&server, &proxies, &state.frpc_log_path);

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
            let conn = state.db.conn();
            match ProxyRepository::get_all_proxies(&conn) {
                Ok(list) => ApiResponse::success(serde_json::to_value(list).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "proxy/createProxy" => {
            if let Some(val) = args {
                match serde_json::from_value::<FrpcProxy>(val) {
                    Ok(proxy) => {
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

        // --- LAUNCH ---
        "launch/getStatus" => {
            let status = state.process_mgr.get_status().await;
            ApiResponse::success(serde_json::to_value(status).unwrap_or(Value::Null))
        }
        "launch/terminate" => match state.process_mgr.terminate(app.clone()).await {
            Ok(()) => ApiResponse::success_empty(),
            Err(e) => ApiResponse::internal_error(e.to_string()),
        },
        "launch/launch" => {
            let (server, proxies) = {
                let conn = state.db.conn();
                let server = match ServerRepository::get_server_config(&conn) {
                    Ok(s) => s,
                    Err(e) => return ApiResponse::internal_error(e.to_string()),
                };

                if server.server_addr.trim().is_empty() {
                    return ApiResponse::fail("B1001", "未配置");
                }

                if server.web_server.enable && server.web_server.port > 0 {
                    let bind_addr = format!("127.0.0.1:{}", server.web_server.port);
                    if std::net::TcpListener::bind(&bind_addr).is_err() {
                        return ApiResponse::fail("B1006", "WebServer Port In Use");
                    }
                }

                let proxies = match ProxyRepository::get_all_proxies(&conn) {
                    Ok(p) => p,
                    Err(e) => return ApiResponse::internal_error(e.to_string()),
                };
                (server, proxies)
            };

            let binary_path = if !server.custom_frpc_path.trim().is_empty() {
                let resolved = FrpcDetector::resolve_path(&server.custom_frpc_path);
                if !resolved.exists() || !FrpcDetector::is_executable_binary(&resolved) {
                    return ApiResponse::fail(
                        "B1005",
                        format!("指定的 frpc 二进制文件不存在或不可执行: {}", resolved.display()),
                    );
                }
                resolved
            } else if let Some(release_id) = server.frpc_version {
                let conn = state.db.conn();
                let version = match VersionRepository::find_by_github_release_id(&conn, release_id) {
                    Ok(Some(v)) => v,
                    _ => return ApiResponse::fail("B1005", "未找到版本"),
                };
                let local_path = match version.local_path {
                    Some(p) => PathBuf::from(p),
                    None => return ApiResponse::fail("B1005", "未找到版本"),
                };
                let bin = local_path.join(VersionManager::get_frpc_executable_name());
                if !bin.exists() {
                    let _ = VersionRepository::delete_by_github_release_id(&conn, release_id);
                    return ApiResponse::fail("B1005", "未找到版本");
                }
                bin
            } else {
                let detected = FrpcDetector::detect();
                if detected.found {
                    PathBuf::from(detected.path)
                } else {
                    return ApiResponse::fail("B1005", "未配置 frpc 路径或下载版本");
                }
            };

            let toml_str = ConfigGenerator::gen_toml_config(&server, &proxies, &state.frpc_log_path);
            if let Err(e) = fs::write(&state.config_path, toml_str) {
                return ApiResponse::internal_error(format!("Failed to write frpc.toml: {}", e));
            }

            match state
                .process_mgr
                .start(
                    app.clone(),
                    &binary_path,
                    &state.config_path,
                    &state.frpc_log_path,
                )
                .await
            {
                Ok(()) => {
                    let status = state.process_mgr.get_status().await;
                    ApiResponse::success(serde_json::to_value(status).unwrap_or(Value::Null))
                }
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }

        // --- VERSION ---
        "version/getVersions" => {
            let conn = state.db.conn();
            let versions = state.version_mgr.get_all_catalog_versions(&conn);
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
                Some(Value::Object(map)) => {
                    let id = map.get("version").and_then(|v| v.as_i64()).unwrap_or(0);
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

            match state
                .version_mgr
                .download_version(&state.db, rel_id, mirror)
                .await
            {
                Ok(ver) => ApiResponse::success(serde_json::to_value(ver).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "version/deleteDownloadedVersion" => {
            let rel_id = match args {
                Some(Value::Object(map)) => {
                    map.get("version").and_then(|v| v.as_i64()).unwrap_or(0)
                }
                Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
                _ => 0,
            };
            let conn = state.db.conn();
            match state.version_mgr.delete_version(&conn, rel_id) {
                Ok(()) => ApiResponse::success_empty(),
                Err(e) => ApiResponse::internal_error(e.to_string()),
            }
        }
        "version/importLocalFrpcVersion" => {
            let path_str = match args {
                Some(Value::Object(map)) => map
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                Some(Value::String(s)) => s,
                _ => String::new(),
            };
            if path_str.is_empty() {
                return ApiResponse::internal_error("Missing file path for import");
            }
            let conn = state.db.conn();
            match state
                .version_mgr
                .import_local_file(&conn, &PathBuf::from(path_str))
            {
                Ok(ver) => ApiResponse::success(serde_json::to_value(ver).unwrap_or(Value::Null)),
                Err(e) => ApiResponse::fail("B1004", e.to_string()),
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
            let lines = SystemService::read_log_tail(&state.frpc_log_path, 500);
            ApiResponse::success(Value::String(lines.join("\n")))
        }
        "log/getAppLogContent" => {
            let lines = SystemService::read_log_tail(&state.app_log_path, 500);
            ApiResponse::success(Value::String(lines.join("\n")))
        }
        "log/openFrpcLogFile" => {
            let _ = SystemService::open_path(&state.frpc_log_path);
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

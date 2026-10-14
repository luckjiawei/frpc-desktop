pub mod commands;
pub mod config_gen;
pub mod db;
pub mod downloader;
pub mod models;
pub mod process;
pub mod providers;
pub mod system;

use commands::{ipc_send, AppState};
use db::DbManager;
use downloader::VersionManager;
use process::RuntimeManager;
use std::fs;
use std::path::PathBuf;
use system::SystemService;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--silent"]),
        ))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                #[cfg(target_os = "macos")]
                {
                    let app = window.app_handle();
                    let _ = app.set_dock_visibility(false);
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
            }
        })
        .setup(|app| {
            // Keep the same data dir as Electron's app.getPath("userData") so
            // 1.x users keep their SQLite database, logs and downloaded frpc.
            let base_dir = dirs::config_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Frpc-Desktop");
            let _ = fs::create_dir_all(&base_dir);

            let db_dir = base_dir.join("db");
            let config_dir = base_dir.join("config");
            let log_dir = base_dir.join("log");
            let _ = fs::create_dir_all(&config_dir);
            let _ = fs::create_dir_all(&log_dir);

            let db = DbManager::init(&db_dir)?;
            let version_mgr = VersionManager::new(&base_dir);
            let app_log_path = log_dir.join("main.log");

            let app_state = AppState {
                db,
                runtime: RuntimeManager::new(),
                version_mgr,
                app_data_dir: base_dir,
                config_dir,
                log_dir,
                app_log_path,
            };

            app.manage(app_state);

            // Start background system usage poller
            SystemService::start_usage_poller(app.handle().clone());

            // Build Tray
            let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let start_all_i = MenuItem::with_id(app, "startAll", "全部启动", true, None::<&str>)?;
            let stop_all_i = MenuItem::with_id(app, "stopAll", "全部停止", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &start_all_i, &stop_all_i, &quit_i])?;

            let tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        #[cfg(target_os = "macos")]
                        {
                            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                            let _ = app.set_dock_visibility(true);
                        }
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "startAll" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<AppState>();
                            for result in state.launch_all(&app_handle, false).await {
                                if let Err((id, code, msg)) = result {
                                    log::warn!("Start tunnel {} failed: [{}]: {}", id, code, msg);
                                }
                            }
                        });
                    }
                    "stopAll" => {
                        let runtime = app.state::<AppState>().runtime.clone();
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            runtime.stop_all(&app_handle).await;
                        });
                    }
                    "quit" => {
                        let runtime = app.state::<AppState>().runtime.clone();
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            runtime.stop_all(&app_handle).await;
                            app_handle.exit(0);
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        #[cfg(target_os = "macos")]
                        {
                            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                            let _ = app.set_dock_visibility(true);
                        }
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                });

            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../../public/logo/only/32x32.png"))
                .ok();
            let icon_ref = tray_icon.as_ref().or_else(|| app.default_window_icon());

            if let Some(icon) = icon_ref {
                let _ = tray_builder.icon(icon.clone()).build(app)?;
            } else {
                let _ = tray_builder.build(app)?;
            }
            let server_cfg = {
                let state = app.state::<AppState>();
                let conn = state.db.conn();
                let res = db::server_repo::ServerRepository::get_server_config(
                    &conn,
                    db::tunnel_repo::DEFAULT_TUNNEL_ID,
                )
                .ok();
                res
            };

            let is_silent = std::env::args().any(|a| a == "--silent");
            if let Some(server) = server_cfg {
                use tauri_plugin_autostart::ManagerExt;
                if server.system.launch_at_startup {
                    let _ = app.autolaunch().enable();
                } else {
                    let _ = app.autolaunch().disable();
                }

                if !is_silent && !server.system.silent_startup {
                    #[cfg(target_os = "macos")]
                    {
                        let _ = app.handle().set_activation_policy(tauri::ActivationPolicy::Regular);
                        let _ = app.handle().set_dock_visibility(true);
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else {
                    #[cfg(target_os = "macos")]
                    {
                        let _ = app.handle().set_dock_visibility(false);
                        let _ = app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
                    }
                }

                if server.system.auto_connect_on_startup {
                    let app_handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                        let state = app_handle.state::<AppState>();
                        for result in state.launch_all(&app_handle, true).await {
                            if let Err((id, code, msg)) = result {
                                eprintln!(
                                    "Auto connect tunnel {} on startup failed: [{}]: {}",
                                    id, code, msg
                                );
                            }
                        }
                    });
                }
            } else if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    let _ = app.handle().set_activation_policy(tauri::ActivationPolicy::Regular);
                    let _ = app.handle().set_dock_visibility(true);
                }
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ipc_send])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                let runtime = app_handle.state::<AppState>().runtime.clone();
                let app = app_handle.clone();
                tauri::async_runtime::block_on(async move {
                    runtime.stop_all(&app).await;
                });
            }
        });
}

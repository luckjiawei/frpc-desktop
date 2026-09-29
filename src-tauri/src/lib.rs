pub mod commands;
pub mod config_gen;
pub mod db;
pub mod downloader;
pub mod models;
pub mod process;
pub mod system;

use commands::{ipc_send, AppState};
use db::DbManager;
use downloader::VersionManager;
use process::ProcessManager;
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
        .setup(|app| {
            // Determine app data dir
            let base_dir = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("frpc-desktop");
            let _ = fs::create_dir_all(&base_dir);

            let db_dir = base_dir.join("db");
            let config_dir = base_dir.join("config");
            let log_dir = base_dir.join("log");
            let _ = fs::create_dir_all(&config_dir);
            let _ = fs::create_dir_all(&log_dir);

            let db = DbManager::init(&db_dir)?;
            let process_mgr = ProcessManager::new();
            let version_mgr = VersionManager::new(&base_dir);

            let config_path = config_dir.join("frpc.toml");
            let frpc_log_path = log_dir.join("frpc.log");
            let app_log_path = log_dir.join("main.log");

            let app_state = AppState {
                db,
                process_mgr: process_mgr.clone(),
                version_mgr,
                app_data_dir: base_dir,
                config_path,
                frpc_log_path,
                app_log_path,
            };

            app.manage(app_state);

            // Start background system usage poller
            SystemService::start_usage_poller(app.handle().clone());

            // Build Tray
            let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        let state = app.state::<AppState>();
                        let p_mgr = state.process_mgr.clone();
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = p_mgr.terminate(app_handle.clone()).await;
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ipc_send])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                let state = app_handle.state::<AppState>();
                let p_mgr = state.process_mgr.clone();
                let app = app_handle.clone();
                tauri::async_runtime::block_on(async move {
                    let _ = p_mgr.terminate(app).await;
                });
            }
        });
}

mod audit;
pub mod models;
pub mod state;
mod tray;
pub mod utils;
pub mod commands;
pub mod i18n;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use state::AppState;
use tauri::{Manager, WindowEvent};

pub fn run() {
    let app_state = Arc::new(AppState::new());
    let state_exit = app_state.clone();
    let exit_cleanup_started = Arc::new(AtomicBool::new(false));
    let exit_cleanup_flag = exit_cleanup_started.clone();
    let close_lifecycle = Arc::new(tray::CloseLifecycle::default());
    let setup_lifecycle = close_lifecycle.clone();
    let window_lifecycle = close_lifecycle.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .manage(close_lifecycle)
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            tray::setup(app, setup_lifecycle)?;
            Ok(())
        })
        .on_window_event(move |window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    tray::handle_close_requested(window, api, window_lifecycle.clone());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Environment
            commands::env::check_environment,
            commands::install::install_component_v2,
            commands::uninstall::uninstall_component,
            commands::env::save_tunnel_credentials,
            // Otunnel & Health & Doctor
            commands::otunnel::get_otunnel_status,
            commands::otunnel::start_otunnel,
            commands::otunnel::stop_otunnel,
            commands::otunnel::restart_otunnel,
            commands::otunnel::run_otunnel_doctor,
            commands::otunnel::probe_network_latency,
            // Workspaces
            commands::workspace::list_workspaces,
            commands::workspace::add_workspace,
            commands::workspace::remove_workspace,
            commands::workspace::start_workspace_session,
            commands::workspace::stop_workspace_session,
            commands::workspace::restart_workspace_session,
            commands::workspace::generate_chatgpt_prompt,
            // History
            commands::history::list_history,
            commands::history::clear_history,
            commands::history::export_history_json,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::set_locale,
            commands::settings::refresh_process_environment,
            commands::settings::open_path_in_explorer,
            commands::settings::get_app_version,
            // Application lifecycle
            tray::resolve_close_request,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                // Never perform process-tree teardown on Tauri's UI/event thread.
                // Doing so used to block window close long enough for Windows to
                // mark the application as "Not responding".
                if !exit_cleanup_flag.swap(true, Ordering::AcqRel) {
                    api.prevent_exit();
                    let app_handle = app.clone();
                    let state = state_exit.clone();
                    std::thread::spawn(move || {
                        state.cleanup_all_processes();
                        app_handle.exit(0);
                    });
                }
            }
            tauri::RunEvent::Exit => {
                // Fallback for platform-specific exit paths. AppState cleanup is
                // idempotent, so this is a no-op if the background cleanup ran.
                state_exit.cleanup_all_processes();
            }
            _ => {}
        });
}

use std::path::Path;
use std::sync::Arc;
use tauri::State;
use crate::models::TunnelSettings;
use crate::state::AppState;
use crate::utils::cmd::refresh_process_path;
#[cfg(target_os = "windows")]
use crate::utils::cmd::execute_cmd;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use crate::utils::cmd::execute_raw;

#[tauri::command]
pub fn get_settings(state: State<'_, Arc<AppState>>) -> TunnelSettings {
    state.settings.lock().clone()
}

#[tauri::command]
pub fn update_settings(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    new_settings: TunnelSettings,
) -> Result<TunnelSettings, String> {
    let locale = new_settings.locale.clone();
    *state.settings.lock() = new_settings.clone();
    state.save_settings();
    let _ = crate::tray::update_tray_menu(&app, &locale);
    Ok(new_settings)
}

#[tauri::command]
pub fn set_locale(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    locale: String,
) -> Result<String, String> {
    let normalized = crate::i18n::Locale::from_str(&locale).as_str().to_string();
    {
        let mut settings = state.settings.lock();
        settings.locale = normalized.clone();
    }
    state.save_settings();
    let _ = crate::tray::update_tray_menu(&app, &normalized);
    Ok(normalized)
}

#[tauri::command]
pub fn refresh_process_environment() -> bool {
    refresh_process_path()
}

#[tauri::command]
pub fn open_path_in_explorer(path: String) -> bool {
    let p = Path::new(&path);

    #[cfg(target_os = "windows")]
    {
        if p.is_file() {
            execute_cmd("explorer.exe", &["/select,", &path], None).success
        } else {
            execute_cmd("explorer.exe", &[&path], None).success
        }
    }

    #[cfg(target_os = "macos")]
    {
        if p.is_file() {
            execute_raw("open", &["-R", &path], None).success
        } else {
            execute_raw("open", &[&path], None).success
        }
    }

    #[cfg(target_os = "linux")]
    {
        let target = if p.is_file() {
            p.parent().unwrap_or(p).to_string_lossy().to_string()
        } else {
            path
        };
        execute_raw("xdg-open", &[&target], None).success
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = p;
        false
    }
}

#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

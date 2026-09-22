use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, CloseRequestApi, Emitter, Manager, Runtime, State, Window,
};

const CLOSE_REQUESTED_EVENT: &str = "app-close-requested";
const SHOW_MENU_ID: &str = "tray-show-main-window";
const EXIT_MENU_ID: &str = "tray-exit-application";

#[derive(Debug, PartialEq, Eq)]
enum CloseRequest {
    AllowClose,
    Prompt,
    Ignore,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CloseAction {
    Exit,
    Hide,
    Cancel,
}

impl CloseAction {
    fn from_frontend_action(value: &str) -> Self {
        match value {
            "exit" => Self::Exit,
            "hide" => Self::Hide,
            _ => Self::Cancel,
        }
    }
}

#[derive(Default)]
pub(crate) struct CloseLifecycle {
    prompt_open: AtomicBool,
    exit_requested: AtomicBool,
}

impl CloseLifecycle {
    fn request_exit(&self) {
        self.exit_requested.store(true, Ordering::Release);
    }

    fn begin_close_request(&self) -> CloseRequest {
        if self.exit_requested.load(Ordering::Acquire) {
            return CloseRequest::AllowClose;
        }

        if self
            .prompt_open
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
        {
            CloseRequest::Prompt
        } else {
            CloseRequest::Ignore
        }
    }

    fn finish_prompt(&self, action: CloseAction) -> CloseAction {
        if action == CloseAction::Exit {
            self.request_exit();
        }
        self.prompt_open.store(false, Ordering::Release);
        action
    }
}

pub(crate) fn build_tray_menu<M: Manager<R>, R: Runtime>(
    manager: &M,
    locale: &str,
) -> tauri::Result<Menu<R>> {
    let show_text = crate::i18n::t(locale, "tray.show_main_window");
    let exit_text = crate::i18n::t(locale, "tray.exit");
    let show_item = MenuItem::with_id(manager, SHOW_MENU_ID, show_text, true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(manager)?;
    let exit_item = MenuItem::with_id(manager, EXIT_MENU_ID, exit_text, true, None::<&str>)?;
    Menu::with_items(manager, &[&show_item, &separator, &exit_item])
}

pub(crate) fn update_tray_menu<R: Runtime>(app: &AppHandle<R>, locale: &str) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let menu = build_tray_menu(app, locale)?;
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

pub(crate) fn setup(app: &mut App, lifecycle: Arc<CloseLifecycle>) -> tauri::Result<()> {
    let locale = app
        .try_state::<Arc<crate::state::AppState>>()
        .map(|s| s.settings.lock().locale.clone())
        .unwrap_or_else(|| "zh-CN".to_string());
    let menu = build_tray_menu(app, &locale)?;

    let menu_lifecycle = lifecycle.clone();
    let mut tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("TunnelDock")
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            if event.id() == SHOW_MENU_ID {
                let _ = show_main_window(app);
            } else if event.id() == EXIT_MENU_ID {
                menu_lifecycle.request_exit();
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                let _ = show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

pub(crate) fn handle_close_requested<R: Runtime>(
    window: &Window<R>,
    api: &CloseRequestApi,
    lifecycle: Arc<CloseLifecycle>,
) {
    match lifecycle.begin_close_request() {
        CloseRequest::AllowClose => {}
        CloseRequest::Ignore => api.prevent_close(),
        CloseRequest::Prompt => {
            api.prevent_close();

            // Do not use the operating-system message box here. The app provides
            // its own themed close confirmation so the experience stays visually
            // consistent on Windows, macOS, and Linux.
            if window.emit(CLOSE_REQUESTED_EVENT, ()).is_err() {
                lifecycle.finish_prompt(CloseAction::Cancel);
            }
        }
    }
}

#[tauri::command]
pub(crate) fn resolve_close_request<R: Runtime>(
    app: AppHandle<R>,
    lifecycle: State<'_, Arc<CloseLifecycle>>,
    action: String,
) -> Result<(), String> {
    match lifecycle.finish_prompt(CloseAction::from_frontend_action(&action)) {
        CloseAction::Exit => app.exit(0),
        CloseAction::Hide => {
            if let Some(window) = app.get_webview_window("main") {
                window.hide().map_err(|error| error.to_string())?;
            }
        }
        CloseAction::Cancel => {}
    }

    Ok(())
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_close_prompt_can_be_open() {
        let lifecycle = CloseLifecycle::default();

        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Prompt);
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Ignore);
    }

    #[test]
    fn minimizing_to_tray_releases_the_prompt_guard() {
        let lifecycle = CloseLifecycle::default();
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Prompt);

        let action = lifecycle.finish_prompt(CloseAction::Hide);

        assert_eq!(action, CloseAction::Hide);
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Prompt);
    }

    #[test]
    fn cancelling_close_keeps_the_window_open_and_releases_the_prompt_guard() {
        let lifecycle = CloseLifecycle::default();
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Prompt);

        let action = lifecycle.finish_prompt(CloseAction::Cancel);

        assert_eq!(action, CloseAction::Cancel);
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Prompt);
    }

    #[test]
    fn confirming_exit_allows_later_close_requests() {
        let lifecycle = CloseLifecycle::default();
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::Prompt);

        let action = lifecycle.finish_prompt(CloseAction::Exit);

        assert_eq!(action, CloseAction::Exit);
        assert_eq!(lifecycle.begin_close_request(), CloseRequest::AllowClose);
    }

    #[test]
    fn tray_exit_allows_close_without_a_prompt() {
        let lifecycle = CloseLifecycle::default();

        lifecycle.request_exit();

        assert_eq!(lifecycle.begin_close_request(), CloseRequest::AllowClose);
    }

    #[test]
    fn frontend_actions_map_to_supported_close_actions() {
        assert_eq!(CloseAction::from_frontend_action("exit"), CloseAction::Exit);
        assert_eq!(CloseAction::from_frontend_action("hide"), CloseAction::Hide);
        assert_eq!(CloseAction::from_frontend_action("cancel"), CloseAction::Cancel);
        assert_eq!(CloseAction::from_frontend_action("unexpected"), CloseAction::Cancel);
    }
}

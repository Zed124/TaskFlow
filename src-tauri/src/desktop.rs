//! Windows desktop integration: system tray, close-to-tray, quit flow and window visibility.
//!
//! Business logic stays in TypeScript. Rust only owns what the OS requires:
//! - the tray icon and its menu (actions are forwarded to the frontend as events),
//! - intercepting the window close button,
//! - exiting the process once the frontend has flushed pending work.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime, WindowEvent};

pub const MAIN_WINDOW: &str = "main";
pub const TRAY_ID: &str = "main";
pub const MINIMIZED_ARG: &str = "--minimized";

/// Events sent to the frontend.
pub const EVENT_QUIT_REQUESTED: &str = "app://quit-requested";
pub const EVENT_TRAY_NEW_TASK: &str = "tray://new-task";
pub const EVENT_TRAY_TIMER: &str = "tray://timer";

/// How long the frontend gets to flush pending edits before the process exits anyway.
const QUIT_GRACE: Duration = Duration::from_secs(4);

pub struct DesktopState {
    /// Mirrors the `system.closeToTray` setting (pushed by the frontend at startup and on change).
    pub close_to_tray: AtomicBool,
    /// Set once a quit has been requested, so the close handler lets the window go.
    pub quitting: AtomicBool,
    pub tray_items: Mutex<Option<TrayItems>>,
}

impl Default for DesktopState {
    fn default() -> Self {
        Self { close_to_tray: AtomicBool::new(true), quitting: AtomicBool::new(false), tray_items: Mutex::new(None) }
    }
}

pub struct TrayItems {
    status: MenuItem<tauri::Wry>,
    pause: MenuItem<tauri::Wry>,
    stop: MenuItem<tauri::Wry>,
}

/// Window background per theme. Must match `preview.canvas` in src/domain/themes.ts
/// (themes.test.ts checks it), so the window never flashes the wrong color at startup.
pub const THEME_CANVAS: [(&str, &str); 5] = [
    ("light", "#f7f7f9"),
    ("dark", "#131318"),
    ("midnight", "#08080a"),
    ("dusk", "#10141f"),
    ("paper", "#f4f0e8"),
];

/// Title bar mode (None = follow Windows) and background for a saved theme choice.
/// Unknown values fall back to Dark, the default.
pub fn window_theme(choice: &str, system_light: bool) -> (Option<tauri::Theme>, &'static str) {
    let resolved = match choice {
        "system" if system_light => "light",
        "system" => "dark",
        other => other,
    };
    let canvas = THEME_CANVAS
        .iter()
        .find(|(name, _)| *name == resolved)
        .map_or(THEME_CANVAS[1].1, |(_, hex)| *hex);
    let mode = match (choice, resolved) {
        ("system", _) => None,
        (_, "light" | "paper") => Some(tauri::Theme::Light),
        _ => Some(tauri::Theme::Dark),
    };
    (mode, canvas)
}

fn parse_hex(hex: &str) -> Option<tauri::window::Color> {
    let h = hex.strip_prefix('#')?;
    let byte = |i: usize| u8::from_str_radix(h.get(i..i + 2)?, 16).ok();
    Some(tauri::window::Color(byte(0)?, byte(2)?, byte(4)?, 255))
}

/// Styles the (still hidden) main window from the saved theme before it is shown. On a first run
/// the settings table doesn't exist yet, which simply means the default theme.
pub fn apply_saved_theme<R: Runtime>(app: &AppHandle<R>, db: &crate::db::Db) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else { return };
    let choice = db
        .select("SELECT value FROM settings WHERE key = 'ui.theme'", &[])
        .ok()
        .and_then(|rows| rows.into_iter().next())
        .and_then(|row| row.get("value").and_then(|v| v.as_str()).map(str::to_owned))
        .and_then(|raw| serde_json::from_str::<String>(&raw).ok())
        .unwrap_or_else(|| "dark".to_owned());
    if choice == "system" {
        let _ = window.set_theme(None);
    }
    let system_light = matches!(window.theme(), Ok(tauri::Theme::Light));
    let (mode, canvas) = window_theme(&choice, system_light);
    let _ = window.set_theme(mode);
    let _ = window.set_background_color(parse_hex(canvas));
}

/// True when Windows launched us at sign-in (autostart passes `--minimized`).
pub fn launched_minimized<I: IntoIterator<Item = String>>(args: I) -> bool {
    args.into_iter().any(|a| a == MINIMIZED_ARG)
}

pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Asks the frontend to flush (blur editors, finish pending writes) and then call `app_exit`.
/// Exits regardless after a grace period, so a hung webview can never block quitting.
pub fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<DesktopState>();
    if state.quitting.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = app.emit(EVENT_QUIT_REQUESTED, ());
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(QUIT_GRACE);
        handle.exit(0);
    });
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open TaskFlow", true, None::<&str>)?;
    let new_task = MenuItem::with_id(app, "new-task", "New task…", true, None::<&str>)?;
    let status = MenuItem::with_id(app, "timer-status", "No timer running", false, None::<&str>)?;
    let pause = MenuItem::with_id(app, "timer-toggle", "Pause timer", false, None::<&str>)?;
    let stop = MenuItem::with_id(app, "timer-stop", "Stop timer", false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit TaskFlow", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &new_task,
            &PredefinedMenuItem::separator(app)?,
            &status,
            &pause,
            &stop,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("TaskFlow")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "new-task" => {
                show_main(app);
                let _ = app.emit(EVENT_TRAY_NEW_TASK, ());
            }
            "timer-toggle" => {
                let _ = app.emit(EVENT_TRAY_TIMER, "toggle");
            }
            "timer-stop" => {
                let _ = app.emit(EVENT_TRAY_TIMER, "stop");
            }
            "quit" => request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    *app.state::<DesktopState>().tray_items.lock().expect("tray state") = Some(TrayItems { status, pause, stop });
    Ok(())
}

/// Close button: hide to tray when enabled, otherwise run the quit flow (flush, then exit).
pub fn on_window_event<R: Runtime>(window: &tauri::Window<R>, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW {
        return;
    }
    if let WindowEvent::CloseRequested { api, .. } = event {
        let state = window.state::<DesktopState>();
        if state.quitting.load(Ordering::SeqCst) {
            return; // quit already in progress: let it close
        }
        api.prevent_close();
        if state.close_to_tray.load(Ordering::SeqCst) {
            let _ = window.hide();
        } else {
            request_quit(window.app_handle());
        }
    }
}

// ---------------- commands ----------------

#[tauri::command]
pub fn set_close_to_tray(state: tauri::State<'_, DesktopState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::SeqCst);
}

/// Updates the tray's timer lines. `status` None = no active timer.
#[tauri::command]
pub fn set_tray_timer(
    app: AppHandle,
    state: tauri::State<'_, DesktopState>,
    status: Option<String>,
    running: bool,
) -> Result<(), String> {
    let guard = state.tray_items.lock().map_err(|e| e.to_string())?;
    if let Some(items) = guard.as_ref() {
        let active = status.is_some();
        items.status.set_text(status.as_deref().unwrap_or("No timer running")).map_err(|e| e.to_string())?;
        items.pause.set_text(if running { "Pause timer" } else { "Resume timer" }).map_err(|e| e.to_string())?;
        items.pause.set_enabled(active).map_err(|e| e.to_string())?;
        items.stop.set_enabled(active).map_err(|e| e.to_string())?;
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = status.map_or_else(|| "TaskFlow".to_owned(), |s| format!("TaskFlow — {s}"));
        tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Called by the frontend after it has flushed pending work.
#[tauri::command]
pub fn app_exit(app: AppHandle) {
    app.exit(0);
}

/// Frontend-initiated quit (e.g. a "Quit" command); same flush contract as the tray.
#[tauri::command]
pub fn app_request_quit(app: AppHandle) {
    request_quit(&app);
}

#[cfg(test)]
mod tests {
    #[test]
    fn window_theme_matches_choice() {
        assert_eq!(window_theme("paper", false), (Some(tauri::Theme::Light), "#f4f0e8"));
        assert_eq!(window_theme("midnight", true), (Some(tauri::Theme::Dark), "#08080a"));
        assert_eq!(window_theme("system", true), (None, "#f7f7f9"));
        assert_eq!(window_theme("system", false), (None, "#131318"));
        assert_eq!(window_theme("bogus", true), (Some(tauri::Theme::Dark), "#131318"));
    }

    #[test]
    fn parses_canvas_colors() {
        assert_eq!(parse_hex("#10141f"), Some(tauri::window::Color(0x10, 0x14, 0x1f, 255)));
        assert_eq!(parse_hex("oops"), None);
    }

    use super::*;

    #[test]
    fn detects_minimized_launch_argument() {
        assert!(launched_minimized(vec!["taskflow.exe".into(), "--minimized".into()]));
        assert!(!launched_minimized(vec!["taskflow.exe".into()]));
        assert!(!launched_minimized(vec!["taskflow.exe".into(), "--minimized=false".into()]));
    }

    #[test]
    fn close_to_tray_defaults_on() {
        let state = DesktopState::default();
        assert!(state.close_to_tray.load(Ordering::SeqCst));
        assert!(!state.quitting.load(Ordering::SeqCst));
    }
}

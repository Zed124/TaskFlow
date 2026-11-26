mod commands;
mod db;
mod desktop;
mod files;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

const DB_FILE_NAME: &str = "taskflow.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second launch focuses the running instance instead.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| desktop::show_main(app)))
        // Remember size/position/maximized, but never visibility: we decide that ourselves.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![desktop::MINIMIZED_ARG]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(desktop::DesktopState::default())
        .setup(|app| {
            // %APPDATA%\com.taskflow.app\taskflow.db
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let database = db::Db::open(&dir.join(DB_FILE_NAME))?;
            desktop::apply_saved_theme(app.handle(), &database);
            app.manage(database);

            desktop::create_tray(app.handle())?;

            // The window starts hidden (tauri.conf.json). Launched by Windows at sign-in →
            // stay in the tray; otherwise show it now that state has been restored.
            if !desktop::launched_minimized(std::env::args()) {
                desktop::show_main(app.handle());
            }
            Ok(())
        })
        .on_window_event(desktop::on_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::db_execute,
            commands::db_select,
            commands::db_execute_batch,
            commands::db_reset,
            commands::db_snapshot,
            desktop::set_close_to_tray,
            desktop::set_tray_timer,
            desktop::app_exit,
            desktop::app_request_quit,
            files::write_export_file,
            files::read_backup_file,
            files::list_backup_files,
            files::delete_backup_file,
            files::default_backup_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TaskFlow");
}

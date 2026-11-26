mod commands;
mod db;

use tauri::Manager;

const DB_FILE_NAME: &str = "taskflow.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // %APPDATA%\com.taskflow.app\taskflow.db
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let database = db::Db::open(&dir.join(DB_FILE_NAME))?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::db_execute,
            commands::db_select,
            commands::db_execute_batch,
            commands::db_reset,
            commands::db_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TaskFlow");
}

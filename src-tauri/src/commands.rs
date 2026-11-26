//! IPC commands exposed to the frontend. Keep these as thin delegations to `Db`.

use serde_json::Value as Json;
use tauri::{AppHandle, Manager, State};

use crate::db::{Db, DbError, ExecResult, Row};

#[tauri::command]
pub fn db_execute(db: State<'_, Db>, sql: String, params: Vec<Json>) -> Result<ExecResult, DbError> {
    db.execute(&sql, &params)
}

#[tauri::command]
pub fn db_select(db: State<'_, Db>, sql: String, params: Vec<Json>) -> Result<Vec<Row>, DbError> {
    db.select(&sql, &params)
}

#[tauri::command]
pub fn db_execute_batch(db: State<'_, Db>, sql: String) -> Result<(), DbError> {
    db.execute_batch(&sql)
}

#[tauri::command]
pub fn db_reset(db: State<'_, Db>) -> Result<bool, DbError> {
    db.reset()
}

/// Writes `%APPDATA%\com.taskflow.app\snapshots\<name>.db` and returns its path.
#[tauri::command]
pub fn db_snapshot(app: AppHandle, db: State<'_, Db>, name: String) -> Result<String, DbError> {
    let valid = !name.is_empty()
        && name.len() <= 100
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if !valid {
        return Err(DbError::InvalidParam { index: 0, reason: "invalid snapshot name".into() });
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DbError::InvalidParam { index: 0, reason: e.to_string() })?
        .join("snapshots");
    std::fs::create_dir_all(&dir)
        .map_err(|e| DbError::InvalidParam { index: 0, reason: e.to_string() })?;
    let target = dir.join(format!("{name}.db"));
    db.snapshot(&target)?;
    Ok(target.to_string_lossy().into_owned())
}

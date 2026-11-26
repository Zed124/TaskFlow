//! Narrow file access for backups and exports. Instead of the general-purpose fs plugin,
//! the frontend gets a few commands that only touch the kinds of files TaskFlow creates:
//! - write/read `.json` and `.csv` files (paths chosen by the user or the backup folder),
//! - list/delete only files named `taskflow-backup-*.json` inside a folder.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, Manager};

pub const BACKUP_PREFIX: &str = "taskflow-backup-";
const MAX_READ_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    /// Milliseconds since the Unix epoch.
    pub modified_ms: u64,
}

fn extension_is(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| allowed.iter().any(|a| a.eq_ignore_ascii_case(e)))
}

pub fn is_backup_file_name(name: &str) -> bool {
    name.starts_with(BACKUP_PREFIX)
        && name.to_ascii_lowercase().ends_with(".json")
        && !name.contains(['/', '\\'])
}

fn checked_export_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err("Path must be absolute".into());
    }
    if !extension_is(&p, &["json", "csv"]) {
        return Err("Only .json and .csv files can be written".into());
    }
    Ok(p)
}

/// Writes UTF-8 text atomically (temp file + rename), creating the folder if needed.
#[tauri::command]
pub fn write_export_file(path: String, contents: String) -> Result<u64, String> {
    let target = checked_export_path(&path)?;
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = target.with_extension("tmp-write");
    fs::write(&tmp, contents.as_bytes()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })?;
    Ok(contents.len() as u64)
}

#[tauri::command]
pub fn read_backup_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !extension_is(&p, &["json"]) {
        return Err("Backups are .json files".into());
    }
    let size = fs::metadata(&p).map_err(|e| e.to_string())?.len();
    if size > MAX_READ_BYTES {
        return Err("File is too large to be a TaskFlow backup".into());
    }
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_backup_files(dir: String) -> Result<Vec<BackupFile>, String> {
    let dir = PathBuf::from(dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_backup_file_name(&name) {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if !meta.is_file() {
            continue;
        }
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_millis() as u64);
        out.push(BackupFile {
            path: entry.path().to_string_lossy().into_owned(),
            name,
            size_bytes: meta.len(),
            modified_ms,
        });
    }
    out.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(out)
}

/// Deletes a backup file. Refuses anything that is not a TaskFlow backup by name.
#[tauri::command]
pub fn delete_backup_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or_default();
    if !is_backup_file_name(name) {
        return Err("Only TaskFlow backup files can be deleted".into());
    }
    fs::remove_file(&p).map_err(|e| e.to_string())
}

/// `Documents\TaskFlow Backups`, the default automatic-backup folder.
#[tauri::command]
pub fn default_backup_dir(app: AppHandle) -> Result<String, String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    Ok(docs.join("TaskFlow Backups").to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_backup_names() {
        assert!(is_backup_file_name("taskflow-backup-auto-20261126-090000.json"));
        assert!(is_backup_file_name("taskflow-backup-2026.JSON"));
        assert!(!is_backup_file_name("notes.json"));
        assert!(!is_backup_file_name("taskflow-backup-x.txt"));
        assert!(!is_backup_file_name("taskflow-backup-..\\evil.json"));
    }

    #[test]
    fn only_json_and_csv_can_be_written() {
        let dir = std::env::temp_dir();
        assert!(checked_export_path(&dir.join("a.json").to_string_lossy()).is_ok());
        assert!(checked_export_path(&dir.join("a.CSV").to_string_lossy()).is_ok());
        assert!(checked_export_path(&dir.join("a.exe").to_string_lossy()).is_err());
        assert!(checked_export_path("relative.json").is_err());
    }

    #[test]
    fn writes_lists_reads_and_deletes_backups() {
        let dir = std::env::temp_dir().join(format!("taskflow-files-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let file = dir.join("taskflow-backup-test.json");
        write_export_file(file.to_string_lossy().into_owned(), "{\"ok\":true}".into()).unwrap();
        fs::write(dir.join("other.json"), "{}").unwrap();

        let listed = list_backup_files(dir.to_string_lossy().into_owned()).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "taskflow-backup-test.json");
        assert_eq!(read_backup_file(listed[0].path.clone()).unwrap(), "{\"ok\":true}");

        assert!(delete_backup_file(dir.join("other.json").to_string_lossy().into_owned()).is_err());
        delete_backup_file(listed[0].path.clone()).unwrap();
        assert!(list_backup_files(dir.to_string_lossy().into_owned()).unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}

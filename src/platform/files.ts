/**
 * File access for backups and exports, through TaskFlow's narrow Rust commands
 * (src-tauri/src/files.rs) and the native open/save dialogs.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface BackupFileInfo {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedMs: number;
}

function requireDesktop(): void {
  if (!isTauri()) throw new Error("File access is only available in the desktop app.");
}

export const files = {
  async defaultBackupDir(): Promise<string> {
    requireDesktop();
    return invoke<string>("default_backup_dir");
  },
  /** Writes UTF-8 text (.json/.csv only); returns bytes written. */
  async write(path: string, contents: string): Promise<number> {
    requireDesktop();
    return invoke<number>("write_export_file", { path, contents });
  },
  async readBackup(path: string): Promise<string> {
    requireDesktop();
    return invoke<string>("read_backup_file", { path });
  },
  async listBackups(dir: string): Promise<BackupFileInfo[]> {
    requireDesktop();
    return invoke<BackupFileInfo[]>("list_backup_files", { dir });
  },
  async deleteBackup(path: string): Promise<void> {
    requireDesktop();
    await invoke("delete_backup_file", { path });
  },
  async pickSavePath(
    defaultPath: string,
    filter: { name: string; extensions: string[] },
  ): Promise<string | null> {
    requireDesktop();
    return save({ defaultPath, filters: [filter] });
  },
  async pickBackupFile(): Promise<string | null> {
    requireDesktop();
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "TaskFlow backup", extensions: ["json"] }],
    });
    return typeof picked === "string" ? picked : null;
  },
  async pickFolder(defaultPath?: string): Promise<string | null> {
    requireDesktop();
    const picked = await open({
      directory: true,
      multiple: false,
      ...(defaultPath ? { defaultPath } : {}),
    });
    return typeof picked === "string" ? picked : null;
  },
};

/** Joins a Windows folder and a file name. */
export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, "")}\\${name}`;
}

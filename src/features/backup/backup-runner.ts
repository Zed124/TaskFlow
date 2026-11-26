import type { Services } from "@/app/services";
import { backupFileName, backupsToPrune, isBackupDue } from "@/domain/backup";
import { errorMessage } from "@/lib/errors";
import { Mutex } from "@/lib/mutex";
import { files, joinPath } from "@/platform/files";
import type { BackupKind } from "./backup-service";

export interface BackupResult {
  path: string;
  sizeBytes: number;
}

/**
 * One backup at a time: the scheduler, "Back up now", exports and the pre-restore safety copy
 * all queue here, so they never race on the same file or log a run twice.
 */
const lock = new Mutex();

/** Resolves the configured backup folder (null setting → Documents\TaskFlow Backups). */
export async function backupDirectory(configured: string | null): Promise<string> {
  return configured ?? (await files.defaultBackupDir());
}

async function write(services: Services, kind: BackupKind, path: string): Promise<BackupResult> {
  const runId = await services.backup.startRun(kind);
  try {
    const doc = await services.backup.exportDocument();
    const sizeBytes = await files.write(path, JSON.stringify(doc));
    await services.backup.finishRun(runId, { ok: true, path, sizeBytes });
    return { path, sizeBytes };
  } catch (error) {
    await services.backup.finishRun(runId, { ok: false, error: errorMessage(error) });
    throw error;
  }
}

async function autoBackup(
  services: Services,
  opts: { directory: string | null; retention: number },
) {
  const dir = await backupDirectory(opts.directory);
  const result = await write(services, "auto", joinPath(dir, backupFileName("auto", new Date())));
  const existing = await files.listBackups(dir);
  for (const name of backupsToPrune(
    existing.map((f) => f.name),
    opts.retention,
  )) {
    const file = existing.find((f) => f.name === name);
    if (file) await files.deleteBackup(file.path);
  }
  return result;
}

/** Exports a full backup to `path` and records the run (failures are recorded, then rethrown). */
export function writeBackup(
  services: Services,
  kind: BackupKind,
  path: string,
): Promise<BackupResult> {
  return lock.run(() => write(services, kind, path));
}

/** Automatic-style backup into the backup folder now ("Back up now"), then prune. */
export function runAutoBackup(
  services: Services,
  opts: { directory: string | null; retention: number },
): Promise<BackupResult> {
  return lock.run(() => autoBackup(services, opts));
}

/** Scheduler entry point: checks "due?" inside the lock, so it can't double up with a manual run. */
export function runAutoBackupIfDue(
  services: Services,
  opts: { directory: string | null; retention: number; intervalHours: number },
): Promise<BackupResult | null> {
  return lock.run(async () => {
    const last = await services.backup.lastSuccessAt("auto");
    return isBackupDue(last, opts.intervalHours, new Date()) ? autoBackup(services, opts) : null;
  });
}

/** Safety copy taken right before a restore replaces everything. */
export async function runPreRestoreBackup(
  services: Services,
  directory: string | null,
): Promise<BackupResult> {
  const dir = await backupDirectory(directory);
  return writeBackup(
    services,
    "pre_restore",
    joinPath(dir, backupFileName("pre-restore", new Date())),
  );
}

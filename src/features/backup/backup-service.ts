import type { SqlExecutor, SqlValue } from "@/db/executor";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLE_ORDER,
  backupTables,
  type BackupDocument,
  type BackupRows,
} from "@/domain/backup";
import { ValidationError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { nowIso, type Clock } from "@/lib/time";

const COLUMNS = Object.fromEntries(
  BACKUP_TABLE_ORDER.map((t) => [t, Object.keys(backupTables[t].shape)]),
) as Record<(typeof BACKUP_TABLE_ORDER)[number], string[]>;

export type BackupKind = "auto" | "manual" | "pre_restore";

/**
 * Builds and restores full backups. The restore is all-or-nothing: one transaction with foreign
 * keys deferred to commit, so a backup either replaces everything or changes nothing.
 */
export function createBackupService(
  db: SqlExecutor,
  clock: Clock,
  info: { schemaVersion: number; appVersion: string },
) {
  return {
    async exportDocument(): Promise<BackupDocument> {
      const data = {} as Record<string, unknown[]>;
      for (const table of BACKUP_TABLE_ORDER) {
        const cols = COLUMNS[table].join(", ");
        const order = table === "settings" ? "key" : "rowid";
        data[table] = await db.select(`SELECT ${cols} FROM ${table} ORDER BY ${order}`);
      }
      return {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: info.schemaVersion,
        appVersion: info.appVersion,
        exportedAt: nowIso(clock),
        data: data as BackupRows,
      };
    },

    /** Replaces all user data with the (already validated) backup. */
    async restore(doc: BackupDocument): Promise<void> {
      if (doc.schemaVersion > info.schemaVersion) {
        throw new ValidationError("This backup was made by a newer version of TaskFlow.");
      }
      await db.transaction(async (tx) => {
        await tx.executeBatch("PRAGMA defer_foreign_keys = ON");
        // Children first, so deletes never trip a foreign key.
        for (const table of [...BACKUP_TABLE_ORDER].reverse())
          await tx.execute(`DELETE FROM ${table}`);
        await tx.execute("DELETE FROM notification_log");
        for (const table of BACKUP_TABLE_ORDER) {
          const cols = COLUMNS[table];
          const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
          for (const row of doc.data[table] as Record<string, SqlValue>[]) {
            await tx.execute(
              sql,
              cols.map((c) => row[c] ?? null),
            );
          }
        }
      });
    },

    // ---- backup run log (local to this device) ----

    async startRun(kind: BackupKind): Promise<string> {
      const runId = newId();
      await db.execute(
        "INSERT INTO backup_runs (id, kind, started_at, status) VALUES (?, ?, ?, 'running')",
        [runId, kind, nowIso(clock)],
      );
      return runId;
    },

    async finishRun(
      runId: string,
      result: { ok: true; path: string; sizeBytes: number } | { ok: false; error: string },
    ) {
      await db.execute(
        `UPDATE backup_runs SET finished_at = ?, status = ?, file_path = ?, size_bytes = ?, error = ? WHERE id = ?`,
        result.ok
          ? [nowIso(clock), "succeeded", result.path, result.sizeBytes, null, runId]
          : [nowIso(clock), "failed", null, null, result.error, runId],
      );
    },

    async lastRun(kind?: BackupKind) {
      const rows = await db.select<{
        kind: BackupKind;
        started_at: string;
        finished_at: string | null;
        status: "running" | "succeeded" | "failed";
        file_path: string | null;
        size_bytes: number | null;
        error: string | null;
      }>(
        `SELECT kind, started_at, finished_at, status, file_path, size_bytes, error FROM backup_runs
         ${kind ? "WHERE kind = ?" : ""} ORDER BY started_at DESC LIMIT 1`,
        kind ? [kind] : [],
      );
      return rows[0] ?? null;
    },

    async lastSuccessAt(kind: BackupKind): Promise<string | null> {
      const rows = await db.select<{ at: string | null }>(
        "SELECT max(finished_at) AS at FROM backup_runs WHERE kind = ? AND status = 'succeeded'",
        [kind],
      );
      return rows[0]?.at ?? null;
    },
  };
}

export type BackupService = ReturnType<typeof createBackupService>;

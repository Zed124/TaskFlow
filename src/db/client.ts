import { Database } from "./executor";
import { migrate, type MigrateResult } from "./migrator";
import { migrations } from "./migrations";
import { resetConnection, snapshotDatabase, tauriDriver } from "./drivers/tauri-driver";

export interface DatabaseHandle {
  db: Database;
  migration: MigrateResult;
}

let opening: Promise<DatabaseHandle> | null = null;

/**
 * Opens the app database once per webview session:
 * 1. rolls back any transaction left open by a previous (reloaded) webview,
 * 2. snapshots the file before upgrading an existing schema,
 * 3. applies pending migrations.
 */
export function openDatabase(): Promise<DatabaseHandle> {
  opening ??= (async () => {
    await resetConnection();
    const db = new Database(tauriDriver);
    const migration = await migrate(db, migrations, {
      beforeApply: async (pending, fromVersion) => {
        const target = pending.at(-1)?.version ?? fromVersion;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        await snapshotDatabase(`pre-migration-v${fromVersion}-to-v${target}-${stamp}`);
      },
    });
    return { db, migration };
  })();
  opening.catch(() => {
    opening = null; // allow a retry after a failure
  });
  return opening;
}

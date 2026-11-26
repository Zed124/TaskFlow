import { nowIso, type Clock, systemClock } from "@/lib/time";
import { AppError } from "@/lib/errors";
import type { SqlExecutor } from "./executor";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export interface MigrateResult {
  applied: Migration[];
  currentVersion: number;
}

export interface MigrateOptions {
  clock?: Clock;
  /** Called once before the first pending migration is applied to a database that already has data. */
  beforeApply?: (pending: readonly Migration[], fromVersion: number) => Promise<void>;
}

export class MigrationError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "migration", options);
  }
}

const FILE_RE = /(\d{4})_([a-z0-9_]+)\.sql$/;

/** Turns a `{ path: sql }` map (from import.meta.glob) into an ordered, validated migration list. */
export function parseMigrations(files: Record<string, string>): Migration[] {
  const migrations = Object.entries(files).map(([path, sql]) => {
    const match = FILE_RE.exec(path);
    if (!match) throw new MigrationError(`Invalid migration file name: ${path}`);
    return { version: Number(match[1]), name: match[2] ?? "", sql };
  });
  migrations.sort((a, b) => a.version - b.version);
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new MigrationError(
        `Migration versions must be contiguous from 1; found ${m.version} at position ${i + 1}`,
      );
    }
  });
  return migrations;
}

export async function migrate(
  db: SqlExecutor,
  migrations: readonly Migration[],
  options: MigrateOptions = {},
): Promise<MigrateResult> {
  const clock = options.clock ?? systemClock;

  await db.executeBatch(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TEXT NOT NULL
     );`,
  );

  const rows = await db.select<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  const appliedVersions = new Set(rows.map((r) => r.version));
  const latestKnown = migrations.at(-1)?.version ?? 0;
  const currentVersion = Math.max(0, ...appliedVersions);

  if (currentVersion > latestKnown) {
    throw new MigrationError(
      `The database was created by a newer version of TaskFlow (schema v${currentVersion}; this build knows v${latestKnown}).`,
    );
  }

  const pending = migrations.filter((m) => !appliedVersions.has(m.version));
  if (pending.length === 0) return { applied: [], currentVersion };

  if (currentVersion > 0 && options.beforeApply) {
    await options.beforeApply(pending, currentVersion);
  }

  for (const migration of pending) {
    try {
      await db.transaction(async (tx) => {
        await tx.executeBatch(migration.sql);
        await tx.execute(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
          [migration.version, migration.name, nowIso(clock)],
        );
      });
    } catch (error) {
      throw new MigrationError(`Migration ${migration.version}_${migration.name} failed`, {
        cause: error,
      });
    }
  }

  return { applied: pending, currentVersion: latestKnown };
}

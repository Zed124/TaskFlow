import { invoke } from "@tauri-apps/api/core";
import { DbError, type DbErrorCode } from "@/lib/errors";
import type { ExecResult, SqlDriver, SqlRow } from "../executor";

const KNOWN_CODES: readonly DbErrorCode[] = [
  "constraint",
  "busy",
  "sqlite",
  "invalid_param",
  "internal",
];

function toDbError(raw: unknown): DbError {
  if (typeof raw === "object" && raw !== null && "message" in raw) {
    const { message, code } = raw as { message: unknown; code?: unknown };
    const dbCode = KNOWN_CODES.find((c) => c === code) ?? "sqlite";
    return new DbError(String(message), dbCode, { cause: raw });
  }
  return new DbError(typeof raw === "string" ? raw : "Database call failed", "ipc", { cause: raw });
}

async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toDbError(error);
  }
}

/** Talks to the Rust bridge in src-tauri/src/db.rs. */
export const tauriDriver: SqlDriver = {
  execute: (sql, params) => call<ExecResult>("db_execute", { sql, params }),
  select: (sql, params) => call<SqlRow[]>("db_select", { sql, params }),
  executeBatch: (sql) => call<undefined>("db_execute_batch", { sql }),
};

/** Rolls back a transaction left open by a previous webview session. */
export function resetConnection(): Promise<boolean> {
  return call<boolean>("db_reset", {});
}

/** Writes a consistent copy of the database (VACUUM INTO) to the app's snapshot folder. */
export function snapshotDatabase(name: string): Promise<string> {
  return call<string>("db_snapshot", { name });
}

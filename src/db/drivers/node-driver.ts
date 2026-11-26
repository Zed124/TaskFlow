/**
 * Test-only driver backed by Node's built-in SQLite (node:sqlite, Node >= 22.13).
 * Never imported by app code — it would not run inside the webview.
 */
import { DatabaseSync } from "node:sqlite";
import { DbError } from "@/lib/errors";
import type { ExecResult, SqlDriver, SqlRow, SqlValue } from "../executor";

type Bindable = string | number | null;

function wrap<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = /constraint/i.test(message) ? "constraint" : "sqlite";
    return Promise.reject(new DbError(message, code, { cause: error }));
  }
}

export function createNodeDriver(path = ":memory:"): SqlDriver & { close(): void } {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");

  return {
    execute: (sql, params) =>
      wrap((): ExecResult => {
        const r = db.prepare(sql).run(...(params as Bindable[]));
        return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
      }),
    select: (sql, params: readonly SqlValue[]) =>
      wrap(() =>
        db
          .prepare(sql)
          .all(...(params as Bindable[]))
          .map((row): SqlRow => ({ ...row })),
      ),
    executeBatch: (sql) => wrap(() => db.exec(sql)),
    close: () => db.close(),
  };
}

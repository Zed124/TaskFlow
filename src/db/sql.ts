import type { SqlExecutor, SqlValue } from "./executor";

/**
 * `UPDATE <table> SET a = ?, b = ? WHERE id = ?` for a whitelisted set of columns.
 * Column names come from code (never from user input); values are always bound.
 */
export async function updateById(
  db: SqlExecutor,
  table: "tasks" | "projects" | "categories",
  id: string,
  columns: Readonly<Record<string, SqlValue>>,
): Promise<number> {
  const names = Object.keys(columns);
  if (names.length === 0) return 0;
  for (const name of names) {
    if (!/^[a-z_]+$/.test(name)) throw new Error(`Invalid column name: ${name}`);
  }
  const sets = names.map((n) => `${n} = ?`).join(", ");
  const result = await db.execute(`UPDATE ${table} SET ${sets} WHERE id = ?`, [
    ...names.map((n) => columns[n] ?? null),
    id,
  ]);
  return result.changes;
}

/** `?, ?, ?` for an IN list. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/**
 * Turns free text into a safe FTS5 query: every token is quoted (so operators like
 * AND/NEAR/- are treated literally) and prefix-matched. Returns null when nothing is searchable.
 */
export function toFtsQuery(text: string): string | null {
  const tokens = text
    .normalize("NFKC")
    .split(/\s+/)
    .map((t) => t.replace(/"/g, "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 12);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

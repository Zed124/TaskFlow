import type { SqlExecutor } from "@/db/executor";

/** RFC 4180 field quoting, plus a guard against spreadsheet formula injection. */
export function csvField(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  // A cell starting with = + - @ (or a tab/CR) is evaluated as a formula by Excel; neutralize it.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 byte order mark, so Excel detects the encoding (Arabic/accented titles). */
const BOM = String.fromCharCode(0xfeff);

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  const lines = [header, ...rows].map((r) => r.map(csvField).join(","));
  // CRLF line endings per RFC 4180.
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

const HEADER = [
  "Title",
  "Status",
  "Priority",
  "Due date",
  "Due time",
  "Project",
  "Category",
  "Parent task",
  "Created",
  "Completed",
  "Archived",
  "Tracked minutes",
  "Description",
  "Notes",
  "Id",
] as const;

/** Flat task export for spreadsheets (non-deleted tasks, including subtasks and archived ones). */
export async function exportTasksCsv(db: SqlExecutor): Promise<{ csv: string; rows: number }> {
  const rows = await db.select<{
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    due_time: string | null;
    project: string | null;
    category: string | null;
    parent: string | null;
    created_at: string;
    completed_at: string | null;
    archived_at: string | null;
    tracked_ms: number | null;
    description: string;
    notes: string;
    id: string;
  }>(
    `SELECT t.title, t.status, t.priority, t.due_date, t.due_time,
            p.name AS project,
            CASE WHEN c.deleted_at IS NULL THEN c.name END AS category,
            pt.title AS parent, t.created_at, t.completed_at, t.archived_at,
            (SELECT sum(coalesce(s.duration_ms, 0)) FROM work_sessions s WHERE s.task_id = t.id) AS tracked_ms,
            t.description, t.notes, t.id
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN tasks pt ON pt.id = t.parent_id
     WHERE t.deleted_at IS NULL
     ORDER BY coalesce(pt.created_at, t.created_at), t.parent_id IS NOT NULL, t.created_at`,
  );
  const body = rows.map((r) => [
    r.title,
    r.status,
    r.priority,
    r.due_date,
    r.due_time,
    r.project,
    r.category,
    r.parent,
    r.created_at,
    r.completed_at,
    r.archived_at ? "yes" : "",
    r.tracked_ms ? Math.round(r.tracked_ms / 60_000) : 0,
    r.description,
    r.notes,
    r.id,
  ]);
  return { csv: toCsv(HEADER, body), rows: rows.length };
}

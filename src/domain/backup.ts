import { z } from "zod";

/**
 * TaskFlow backup document (JSON). Rows are stored exactly as in SQLite (snake_case columns),
 * so a backup is lossless: history, completions, intervals, sessions and notes all survive.
 * Device-local operational logs (notification_log, backup_runs) are intentionally excluded.
 */
export const BACKUP_FORMAT = "taskflow-backup";
export const BACKUP_FORMAT_VERSION = 1;

const id = z.string().min(1);
const text = z.string();
const opt = z.string().nullable();
const num = z.number();

/** Parent tables first: this is also the insert order on restore. */
export const backupTables = {
  projects: z.object({
    id,
    name: text,
    description: text,
    color: opt,
    sort_order: num,
    archived_at: opt,
    created_at: text,
    updated_at: text,
    deleted_at: opt,
  }),
  categories: z.object({
    id,
    name: text,
    color: opt,
    sort_order: num,
    archived_at: opt,
    created_at: text,
    updated_at: text,
    deleted_at: opt,
  }),
  tasks: z.object({
    id,
    parent_id: opt,
    project_id: opt,
    category_id: opt,
    title: text,
    description: text,
    notes: text,
    status: z.enum(["todo", "in_progress", "completed", "cancelled"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    due_date: opt,
    due_time: opt,
    remind_at: opt,
    sort_order: num,
    status_changed_at: text,
    completed_at: opt,
    archived_at: opt,
    created_at: text,
    updated_at: text,
    deleted_at: opt,
  }),
  completion_events: z.object({
    id,
    task_id: id,
    completed_at: text,
    completed_on: text,
    reopened_at: opt,
  }),
  status_intervals: z.object({ id, task_id: id, status: text, started_at: text, ended_at: opt }),
  work_sessions: z.object({
    id,
    task_id: id,
    state: z.enum(["running", "paused", "stopped"]),
    started_at: text,
    ended_at: opt,
    duration_ms: num.nullable(),
    note: text,
    created_at: text,
    updated_at: text,
  }),
  work_segments: z.object({ id, session_id: id, started_at: text, ended_at: opt }),
  activity_events: z.object({
    id,
    task_id: opt,
    project_id: opt,
    category_id: opt,
    event_type: text,
    source: z.enum(["system", "user"]),
    body: opt,
    payload: text,
    group_id: opt,
    occurred_at: text,
    edited_at: opt,
  }),
  settings: z.object({ key: text, value: text, updated_at: text }),
} as const;

export type BackupTableName = keyof typeof backupTables;
export const BACKUP_TABLE_ORDER = Object.keys(backupTables) as BackupTableName[];
export type BackupRows = { [T in BackupTableName]: z.infer<(typeof backupTables)[T]>[] };

export const backupDocumentSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  exportedAt: z.string(),
  data: z.object(
    Object.fromEntries(BACKUP_TABLE_ORDER.map((t) => [t, z.array(backupTables[t])])) as {
      [T in BackupTableName]: z.ZodArray<(typeof backupTables)[T]>;
    },
  ),
});
export type BackupDocument = z.infer<typeof backupDocumentSchema>;

export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  counts: Record<BackupTableName, number>;
  /** Top-level, non-deleted tasks: what the user thinks of as "my tasks". */
  activeTasks: number;
}

export type ValidationResult =
  { ok: true; document: BackupDocument; summary: BackupSummary } | { ok: false; errors: string[] };

/**
 * Validates a parsed backup before anything is touched: structure, versions, duplicate ids and
 * every reference between tables. Returns readable errors (first few) instead of throwing.
 */
export function validateBackup(input: unknown, currentSchemaVersion: number): ValidationResult {
  if (
    typeof input !== "object" ||
    input === null ||
    (input as { format?: unknown }).format !== BACKUP_FORMAT
  ) {
    return { ok: false, errors: ["This file is not a TaskFlow backup."] };
  }
  const parsed = backupDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "file"}: ${i.message}`),
    };
  }
  const doc = parsed.data;
  if (doc.schemaVersion > currentSchemaVersion) {
    return {
      ok: false,
      errors: [
        `This backup was made by a newer TaskFlow (data version ${doc.schemaVersion}). Update TaskFlow to restore it.`,
      ],
    };
  }

  const errors: string[] = [];
  const ids = (rows: { id: string }[], table: string) => {
    const set = new Set<string>();
    for (const r of rows) {
      if (set.has(r.id)) errors.push(`${table}: duplicate id ${r.id}`);
      set.add(r.id);
    }
    return set;
  };
  const d = doc.data;
  const projects = ids(d.projects, "projects");
  const categories = ids(d.categories, "categories");
  const tasks = ids(d.tasks, "tasks");
  ids(d.completion_events, "completion_events");
  ids(d.status_intervals, "status_intervals");
  const sessions = ids(d.work_sessions, "work_sessions");
  ids(d.work_segments, "work_segments");
  ids(d.activity_events, "activity_events");

  const ref = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };
  for (const t of d.tasks) {
    ref(
      t.parent_id === null || tasks.has(t.parent_id),
      `task ${t.id}: unknown parent ${t.parent_id ?? ""}`,
    );
    ref(
      t.project_id === null || projects.has(t.project_id),
      `task ${t.id}: unknown project ${t.project_id ?? ""}`,
    );
    ref(
      t.category_id === null || categories.has(t.category_id),
      `task ${t.id}: unknown category ${t.category_id ?? ""}`,
    );
  }
  for (const r of [...d.completion_events, ...d.status_intervals, ...d.work_sessions]) {
    ref(tasks.has(r.task_id), `history row ${r.id}: unknown task ${r.task_id}`);
  }
  for (const s of d.work_segments)
    ref(sessions.has(s.session_id), `work segment ${s.id}: unknown session`);
  for (const a of d.activity_events) {
    ref(a.task_id === null || tasks.has(a.task_id), `activity ${a.id}: unknown task`);
    ref(a.project_id === null || projects.has(a.project_id), `activity ${a.id}: unknown project`);
    ref(
      a.category_id === null || categories.has(a.category_id),
      `activity ${a.id}: unknown category`,
    );
  }
  const activeSessions = d.work_sessions.filter((s) => s.state !== "stopped").length;
  ref(activeSessions <= 1, "More than one timer is marked as running.");

  if (errors.length > 0) {
    const extra = errors.length > 5 ? [`…and ${errors.length - 5} more problems.`] : [];
    return { ok: false, errors: [...errors.slice(0, 5), ...extra] };
  }

  const counts = Object.fromEntries(BACKUP_TABLE_ORDER.map((t) => [t, d[t].length])) as Record<
    BackupTableName,
    number
  >;
  return {
    ok: true,
    document: doc,
    summary: {
      exportedAt: doc.exportedAt,
      schemaVersion: doc.schemaVersion,
      counts,
      activeTasks: d.tasks.filter((t) => t.parent_id === null && t.deleted_at === null).length,
    },
  };
}

/** `taskflow-backup-<kind>-20261126-143005.json` (kind omitted for manual exports). */
export function backupFileName(kind: "auto" | "pre-restore" | null, at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
  return `taskflow-backup-${kind ? `${kind}-` : ""}${stamp}.json`;
}

/** Automatic backups due? (never run, or last success older than the interval) */
export function isBackupDue(
  lastSuccessAt: string | null,
  intervalHours: number,
  now: Date,
): boolean {
  if (!lastSuccessAt) return true;
  return now.getTime() - Date.parse(lastSuccessAt) >= intervalHours * 3_600_000;
}

/** Which automatic backups to delete to keep the newest `keep` (names sort chronologically). */
export function backupsToPrune(names: readonly string[], keep: number): string[] {
  const auto = names
    .filter((n) => n.startsWith("taskflow-backup-auto-"))
    .sort()
    .reverse();
  return auto.slice(Math.max(keep, 1));
}

import type { SqlExecutor } from "@/db/executor";
import { newId } from "@/lib/ids";

/**
 * Bulk-seeds a realistic dataset straight into SQL (fast enough for 10k+ tasks): projects,
 * categories, tasks with subtasks, due dates spread over a year, status history, completions
 * (some reopened), activity events, user notes and work sessions.
 * For performance testing only — never used by the app.
 */
export async function seedLargeDataset(
  db: SqlExecutor,
  opts: { tasks: number; now?: Date; seed?: number } = { tasks: 10_000 },
): Promise<void> {
  const now = opts.now ?? new Date();
  let state = opts.seed ?? 42;
  const rand = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const iso = (ms: number) => new Date(ms).toISOString();
  const day = 86_400_000;
  const localDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const words = [
    "Review",
    "Draft",
    "Plan",
    "Call",
    "Email",
    "Fix",
    "Design",
    "Write",
    "Prepare",
    "Book",
    "Update",
    "Clean",
    "Order",
    "Research",
    "Schedule",
  ];
  const things = [
    "report",
    "budget",
    "invoice",
    "slides",
    "meeting",
    "proposal",
    "release notes",
    "roadmap",
    "dentist",
    "groceries",
    "car service",
    "tax forms",
    "garden",
    "backup",
    "newsletter",
  ];

  await db.transaction(async (tx) => {
    const projects: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = newId();
      projects.push(id);
      await tx.execute(
        "INSERT INTO projects (id, name, description, color, sort_order, archived_at, created_at, updated_at) VALUES (?, ?, '', 'violet', ?, ?, ?, ?)",
        [
          id,
          `Project ${i + 1}`,
          i,
          i > 20 ? iso(now.getTime() - 30 * day) : null,
          iso(now.getTime() - 400 * day),
          iso(now.getTime() - 400 * day),
        ],
      );
    }
    const categories: string[] = [];
    for (const name of [
      "Work",
      "Home",
      "Health",
      "Errands",
      "Learning",
      "Finance",
      "Admin",
      "Family",
    ]) {
      const id = newId();
      categories.push(id);
      await tx.execute(
        "INSERT INTO categories (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, 'slate', 0, ?, ?)",
        [id, name, iso(now.getTime() - 400 * day), iso(now.getTime() - 400 * day)],
      );
    }

    let parentId: string | null = null;
    for (let i = 0; i < opts.tasks; i++) {
      const id = newId();
      const isSub = parentId !== null && rand() < 0.25;
      const created = now.getTime() - Math.floor(rand() * 365) * day - Math.floor(rand() * day);
      const r = rand();
      const status =
        r < 0.55 ? "completed" : r < 0.65 ? "cancelled" : r < 0.8 ? "in_progress" : "todo";
      const hasDue = rand() < 0.7;
      const due = hasDue ? localDate(created + Math.floor(rand() * 60 - 10) * day) : null;
      const completedAt =
        status === "completed" ? created + Math.floor(rand() * 20 * day) + 3_600_000 : null;
      const priority = pick(["low", "medium", "medium", "high", "urgent"] as const);
      await tx.execute(
        `INSERT INTO tasks (id, parent_id, project_id, category_id, title, description, notes, status, priority,
           due_date, due_time, sort_order, status_changed_at, completed_at, archived_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          isSub ? parentId : null,
          rand() < 0.7 ? pick(projects) : null,
          rand() < 0.6 ? pick(categories) : null,
          `${pick(words)} ${pick(things)} #${i}`,
          rand() < 0.3 ? `Details about ${pick(things)} and ${pick(things)}` : "",
          status,
          priority,
          due,
          due && rand() < 0.2 ? "14:30" : null,
          i,
          iso(completedAt ?? created),
          completedAt ? iso(completedAt) : null,
          status === "completed" && rand() < 0.2 ? iso(now.getTime()) : null,
          iso(created),
          iso(completedAt ?? created),
          rand() < 0.02 ? iso(now.getTime()) : null,
        ],
      );
      if (!isSub) parentId = id;

      // History: created event, intervals, completion(s).
      await tx.execute(
        "INSERT INTO activity_events (id, task_id, event_type, source, payload, occurred_at) VALUES (?, ?, 'created', 'system', ?, ?)",
        [newId(), id, JSON.stringify({ title: "t", parentId: null }), iso(created)],
      );
      const startedProgress = status !== "todo" && rand() < 0.8;
      const ipStart = created + 3_600_000;
      if (startedProgress) {
        await tx.execute(
          "INSERT INTO status_intervals (id, task_id, status, started_at, ended_at) VALUES (?, ?, 'todo', ?, ?)",
          [newId(), id, iso(created), iso(ipStart)],
        );
        const ipEnd = completedAt ?? (status === "in_progress" ? null : ipStart + day);
        await tx.execute(
          "INSERT INTO status_intervals (id, task_id, status, started_at, ended_at) VALUES (?, ?, 'in_progress', ?, ?)",
          [newId(), id, iso(ipStart), ipEnd ? iso(ipEnd) : null],
        );
        if (ipEnd) {
          await tx.execute(
            "INSERT INTO status_intervals (id, task_id, status, started_at, ended_at) VALUES (?, ?, ?, ?, NULL)",
            [newId(), id, status, iso(ipEnd)],
          );
        }
      } else {
        await tx.execute(
          "INSERT INTO status_intervals (id, task_id, status, started_at, ended_at) VALUES (?, ?, ?, ?, NULL)",
          [newId(), id, status, iso(created)],
        );
      }
      if (completedAt) {
        if (rand() < 0.1) {
          await tx.execute(
            "INSERT INTO completion_events (id, task_id, completed_at, completed_on, reopened_at) VALUES (?, ?, ?, ?, ?)",
            [
              newId(),
              id,
              iso(completedAt - day),
              localDate(completedAt - day),
              iso(completedAt - day + 3_600_000),
            ],
          );
        }
        await tx.execute(
          "INSERT INTO completion_events (id, task_id, completed_at, completed_on, reopened_at) VALUES (?, ?, ?, ?, NULL)",
          [newId(), id, iso(completedAt), localDate(completedAt)],
        );
        await tx.execute(
          "INSERT INTO activity_events (id, task_id, event_type, source, payload, occurred_at) VALUES (?, ?, 'completed', 'system', ?, ?)",
          [newId(), id, JSON.stringify({ from: "in_progress", to: "completed" }), iso(completedAt)],
        );
      }
      if (rand() < 0.1) {
        await tx.execute(
          "INSERT INTO activity_events (id, task_id, event_type, source, body, payload, occurred_at) VALUES (?, ?, 'note', 'user', ?, '{}', ?)",
          [
            newId(),
            id,
            `Note about ${pick(things)}: follow up with ${pick(things)}`,
            iso(created + 7_200_000),
          ],
        );
      }
      if (rand() < 0.15) {
        const sid = newId();
        const start = created + 2 * 3_600_000;
        const dur = Math.floor(rand() * 3 * 3_600_000);
        await tx.execute(
          `INSERT INTO work_sessions (id, task_id, state, started_at, ended_at, duration_ms, note, created_at, updated_at)
           VALUES (?, ?, 'stopped', ?, ?, ?, '', ?, ?)`,
          [sid, id, iso(start), iso(start + dur), dur, iso(start), iso(start + dur)],
        );
        await tx.execute(
          "INSERT INTO work_segments (id, session_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
          [newId(), sid, iso(start), iso(start + dur)],
        );
      }
    }
  });
}

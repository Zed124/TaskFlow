/**
 * Verifies the database-level invariants declared in 0001_initial.sql.
 * These are the safety net under the services: even buggy code must not be able to
 * break history (e.g. two open completions for one task).
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./executor";
import { createTestDb } from "@/test/test-db";

const T0 = "2026-11-26T09:00:00.000Z";
const T1 = "2026-11-26T10:00:00.000Z";

let db: Database;

async function insertTask(id: string, overrides: Record<string, string | null> = {}) {
  const row: Record<string, string | null> = {
    id,
    title: `Task ${id}`,
    status: "todo",
    status_changed_at: T0,
    created_at: T0,
    updated_at: T0,
    ...overrides,
  };
  const cols = Object.keys(row);
  await db.execute(
    `INSERT INTO tasks (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    Object.values(row),
  );
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("tasks", () => {
  it("accepts a minimal task with defaults", async () => {
    await insertTask("t1");
    const [task] = await db.select("SELECT status, priority, due_date FROM tasks WHERE id = 't1'");
    expect(task).toEqual({ status: "todo", priority: "medium", due_date: null });
  });

  it("rejects blank titles and unknown status/priority", async () => {
    await expect(insertTask("t1", { title: "   " })).rejects.toThrow();
    await expect(insertTask("t2", { status: "done" })).rejects.toThrow();
    await expect(insertTask("t3", { priority: "critical" })).rejects.toThrow();
  });

  it("requires completed_at exactly when status is completed", async () => {
    await expect(insertTask("t1", { status: "completed" })).rejects.toThrow();
    await expect(insertTask("t2", { completed_at: T1 })).rejects.toThrow();
    await insertTask("t3", { status: "completed", completed_at: T1 });
  });

  it("validates date-only due dates and only allows a due time with a due date", async () => {
    await insertTask("t1", { due_date: "2026-12-01", due_time: "17:30" });
    await expect(insertTask("t2", { due_date: "2026-12-01T00:00:00Z" })).rejects.toThrow();
    await expect(insertTask("t3", { due_time: "09:00" })).rejects.toThrow();
  });

  it("supports subtasks and prevents self-parenting", async () => {
    await insertTask("parent");
    await insertTask("child", { parent_id: "parent" });
    await expect(insertTask("x", { parent_id: "missing" })).rejects.toThrow();
    await expect(insertTask("self", { parent_id: "self" })).rejects.toThrow();
  });

  it("detaches tasks from a purged project instead of deleting them", async () => {
    await db.execute(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'Home', ?, ?)",
      [T0, T0],
    );
    await insertTask("t1", { project_id: "p1" });
    await db.execute("DELETE FROM projects WHERE id = 'p1'");
    expect(await db.select("SELECT project_id FROM tasks WHERE id = 't1'")).toEqual([
      { project_id: null },
    ]);
  });
});

describe("history invariants", () => {
  beforeEach(async () => {
    await insertTask("t1");
  });

  it("keeps multiple completion records but allows only one open completion per task", async () => {
    const insert = (id: string, reopened: string | null) =>
      db.execute(
        "INSERT INTO completion_events (id, task_id, completed_at, completed_on, reopened_at) VALUES (?, 't1', ?, '2026-11-26', ?)",
        [id, T0, reopened],
      );
    await insert("c1", T1); // completed, then reopened
    await insert("c2", null); // completed again (open)
    await expect(insert("c3", null)).rejects.toThrow();
    expect(await db.select("SELECT id FROM completion_events ORDER BY id")).toHaveLength(2);
  });

  it("rejects a reopen earlier than the completion", async () => {
    await expect(
      db.execute(
        "INSERT INTO completion_events (id, task_id, completed_at, completed_on, reopened_at) VALUES ('c1', 't1', ?, '2026-11-26', ?)",
        [T1, T0],
      ),
    ).rejects.toThrow();
  });

  it("allows only one open status interval per task", async () => {
    const insert = (id: string, ended: string | null) =>
      db.execute(
        "INSERT INTO status_intervals (id, task_id, status, started_at, ended_at) VALUES (?, 't1', 'todo', ?, ?)",
        [id, T0, ended],
      );
    await insert("i1", T1);
    await insert("i2", null);
    await expect(insert("i3", null)).rejects.toThrow();
  });

  it("allows only one running or paused work session across all tasks", async () => {
    await insertTask("t2");
    const insert = (id: string, task: string, state: string) =>
      db.execute(
        `INSERT INTO work_sessions (id, task_id, state, started_at, ended_at, duration_ms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          task,
          state,
          T0,
          state === "stopped" ? T1 : null,
          state === "stopped" ? 3_600_000 : null,
          T0,
          T0,
        ],
      );
    await insert("s1", "t1", "stopped");
    await insert("s2", "t1", "stopped");
    await insert("s3", "t1", "running");
    await expect(insert("s4", "t2", "paused")).rejects.toThrow();
    await expect(insert("s5", "t2", "running")).rejects.toThrow();
  });

  it("requires activity events to belong to exactly one entity, and notes to be user-authored with text", async () => {
    const insert = (values: Record<string, string | null>) => {
      const cols = Object.keys(values);
      return db.execute(
        `INSERT INTO activity_events (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        Object.values(values),
      );
    };
    await insert({
      id: "a1",
      task_id: "t1",
      event_type: "created",
      source: "system",
      occurred_at: T0,
    });
    await insert({
      id: "a2",
      task_id: "t1",
      event_type: "note",
      source: "user",
      body: "Called vendor",
      occurred_at: T0,
    });

    await expect(
      insert({ id: "a3", event_type: "created", source: "system", occurred_at: T0 }),
    ).rejects.toThrow();
    await expect(
      insert({
        id: "a4",
        task_id: "t1",
        event_type: "note",
        source: "system",
        body: "x",
        occurred_at: T0,
      }),
    ).rejects.toThrow();
    await expect(
      insert({
        id: "a5",
        task_id: "t1",
        event_type: "note",
        source: "user",
        body: "  ",
        occurred_at: T0,
      }),
    ).rejects.toThrow();
    await expect(
      insert({
        id: "a6",
        task_id: "t1",
        event_type: "created",
        source: "system",
        payload: "{bad",
        occurred_at: T0,
      }),
    ).rejects.toThrow();
  });
});

describe("categories", () => {
  it("enforces case-insensitive unique names among non-deleted categories", async () => {
    const insert = (id: string, name: string, deleted: string | null = null) =>
      db.execute(
        "INSERT INTO categories (id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)",
        [id, name, T0, T0, deleted],
      );
    await insert("c1", "Work", T1); // soft-deleted
    await insert("c2", "work");
    await expect(insert("c3", "WORK")).rejects.toThrow();
  });
});

describe("search index triggers", () => {
  const search = (q: string) =>
    db.select<{ entity_type: string; entity_id: string }>(
      "SELECT entity_type, entity_id FROM search_index WHERE search_index MATCH ? ORDER BY entity_type",
      [q],
    );

  it("indexes tasks, projects, categories and notes, and follows updates and soft deletes", async () => {
    await insertTask("t1", { title: "Renew passport", description: "Bring photos" });
    await db.execute(
      "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES ('p1', 'Travel', 'Passport and visas', ?, ?)",
      [T0, T0],
    );
    await db.execute(
      "INSERT INTO categories (id, name, created_at, updated_at) VALUES ('c1', 'Passport office', ?, ?)",
      [T0, T0],
    );
    await db.execute(
      "INSERT INTO activity_events (id, task_id, event_type, source, body, occurred_at) VALUES ('n1', 't1', 'note', 'user', 'Passport photos ready', ?)",
      [T0],
    );

    expect((await search("passport*")).map((r) => r.entity_type)).toEqual([
      "category",
      "note",
      "project",
      "task",
    ]);
    expect(await search("photos")).toHaveLength(2);

    await db.execute("UPDATE tasks SET title = 'Renew licence', description = '' WHERE id = 't1'");
    expect((await search("licence")).map((r) => r.entity_id)).toEqual(["t1"]);
    expect((await search("passport")).map((r) => r.entity_type)).toEqual([
      "category",
      "note",
      "project",
    ]);

    await db.execute("UPDATE tasks SET deleted_at = ? WHERE id = 't1'", [T1]);
    expect(await search("licence")).toHaveLength(0);

    await db.execute("UPDATE tasks SET deleted_at = NULL WHERE id = 't1'");
    expect(await search("licence")).toHaveLength(1);
  });

  it("matches without diacritics", async () => {
    await insertTask("t1", { title: "Café opening" });
    expect(await search("cafe")).toHaveLength(1);
  });
});

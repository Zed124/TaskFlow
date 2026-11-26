import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import type { Database } from "@/db/executor";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { toLocalDate, type createFixedClock } from "@/lib/time";
import { createTestServices, DAY, HOUR } from "@/test/test-services";

let services: Services;
let clock: ReturnType<typeof createFixedClock>;
let db: Database;

beforeEach(async () => {
  ({ services, clock, db } = await createTestServices());
});

const events = async (taskId: string) =>
  (await services.activity.listForTask(taskId)).map((e) => e.eventType);

describe("creating tasks", () => {
  it("creates a task with defaults, an open To Do interval and a 'created' event", async () => {
    const task = await services.tasks.create({ title: "  Write report  " });

    expect(task).toMatchObject({
      title: "Write report",
      status: "todo",
      priority: "medium",
      dueDate: null,
      projectId: null,
      categoryId: null,
      parentId: null,
      completedAt: null,
      createdAt: "2026-11-23T09:00:00.000Z",
    });
    const details = await services.tasks.getDetails(task.id);
    expect(details?.intervals).toEqual([
      expect.objectContaining({ status: "todo", startedAt: task.createdAt, endedAt: null }),
    ]);
    const [created] = await services.activity.listForTask(task.id);
    expect(created).toMatchObject({
      eventType: "created",
      source: "system",
      payload: { title: "Write report", parentId: null },
    });
  });

  it("does not require a due date, but validates one when given", async () => {
    await expect(
      services.tasks.create({ title: "x", dueDate: "2026-02-30" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(services.tasks.create({ title: "x", dueTime: "09:00" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(services.tasks.create({ title: "   " })).rejects.toBeInstanceOf(ValidationError);

    const t = await services.tasks.create({
      title: "Dentist",
      dueDate: "2026-12-01",
      dueTime: "14:30",
    });
    expect(t).toMatchObject({ dueDate: "2026-12-01", dueTime: "14:30" });
  });

  it("records a completion when created already completed", async () => {
    const t = await services.tasks.create({ title: "Done already", status: "completed" });
    expect(t.completedAt).toBe(t.createdAt);
    expect((await services.tasks.getDetails(t.id))?.completions).toHaveLength(1);
  });

  it("rejects unknown projects and categories without writing anything", async () => {
    await expect(services.tasks.create({ title: "x", projectId: "nope" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(services.tasks.create({ title: "x", categoryId: "nope" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await db.select("SELECT id FROM tasks")).toHaveLength(0);
    expect(await db.select("SELECT id FROM activity_events")).toHaveLength(0);
  });
});

describe("editing tasks", () => {
  it("records one event per changed field, grouped, and ignores unchanged fields", async () => {
    const t = await services.tasks.create({ title: "Draft", priority: "low" });
    clock.advance(HOUR);

    const updated = await services.tasks.update(t.id, {
      title: "Final draft",
      description: "Two pages",
      priority: "urgent",
      notes: "", // unchanged
    });

    expect(updated).toMatchObject({
      title: "Final draft",
      description: "Two pages",
      priority: "urgent",
    });
    expect(updated.updatedAt).toBe("2026-11-23T10:00:00.000Z");
    const history = await services.activity.listForTask(t.id);
    const changes = history.slice(1);
    expect(changes.map((e) => e.eventType)).toEqual([
      "field_changed",
      "field_changed",
      "priority_changed",
    ]);
    expect(changes[0]).toMatchObject({
      payload: { field: "title", from: "Draft", to: "Final draft" },
    });
    expect(changes[2]).toMatchObject({ payload: { from: "low", to: "urgent" } });
    expect(new Set(changes.map((e) => e.groupId)).size).toBe(1);

    await services.tasks.update(t.id, { title: "Final draft" });
    expect(await services.activity.listForTask(t.id)).toHaveLength(history.length);
  });

  it("tracks due date changes and clears the time when the date is removed", async () => {
    const t = await services.tasks.create({ title: "x", dueDate: "2026-12-01", dueTime: "09:00" });
    const cleared = await services.tasks.update(t.id, { dueDate: null });
    expect(cleared).toMatchObject({ dueDate: null, dueTime: null });
    const last = (await services.activity.listForTask(t.id)).at(-1);
    expect(last).toMatchObject({
      eventType: "due_changed",
      payload: { fromDate: "2026-12-01", fromTime: "09:00", toDate: null, toTime: null },
    });
  });

  it("records project and category moves with the names at the time", async () => {
    const home = await services.projects.create({ name: "Home" });
    const work = await services.projects.create({ name: "Work" });
    const errands = await services.categories.create({ name: "Errands" });
    const t = await services.tasks.create({ title: "x", projectId: home.id });

    await services.tasks.update(t.id, { projectId: work.id, categoryId: errands.id });
    await services.projects.update(work.id, { name: "Office" });

    const history = await services.activity.listForTask(t.id);
    expect(history.find((e) => e.eventType === "project_changed")).toMatchObject({
      payload: { from: { id: home.id, name: "Home" }, to: { id: work.id, name: "Work" } },
    });
    expect(history.find((e) => e.eventType === "category_changed")).toMatchObject({
      payload: { from: null, to: { id: errands.id, name: "Errands" } },
    });
  });

  it("fails cleanly for a missing task", async () => {
    await expect(services.tasks.update("missing", { title: "x" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("status changes and completion history", () => {
  it("maintains status intervals and events through a normal flow", async () => {
    const t = await services.tasks.create({ title: "x" });
    clock.advance(HOUR);
    await services.tasks.setStatus(t.id, "in_progress");
    clock.advance(2 * HOUR);
    const done = await services.tasks.setStatus(t.id, "completed");

    expect(done.status).toBe("completed");
    expect(done.completedAt).toBe("2026-11-23T12:00:00.000Z");
    const details = (await services.tasks.getDetails(t.id))!;
    expect(details.intervals.map((i) => [i.status, i.startedAt, i.endedAt])).toEqual([
      ["todo", "2026-11-23T09:00:00.000Z", "2026-11-23T10:00:00.000Z"],
      ["in_progress", "2026-11-23T10:00:00.000Z", "2026-11-23T12:00:00.000Z"],
      ["completed", "2026-11-23T12:00:00.000Z", null],
    ]);
    expect(details.statusDurations).toEqual({
      inProgressMs: 2 * HOUR,
      inProgressOngoing: false,
      inProgressStretches: 1,
    });
    expect(await events(t.id)).toEqual(["created", "status_changed", "completed"]);
  });

  it("keeps every completion when a task is completed, reopened and completed again", async () => {
    const t = await services.tasks.create({ title: "Weekly review" });
    clock.set("2026-11-23T12:00:00.000Z"); // Monday
    await services.tasks.setStatus(t.id, "completed");
    clock.set("2026-11-24T12:00:00.000Z"); // Tuesday
    const reopened = await services.tasks.setStatus(t.id, "todo");
    expect(reopened.completedAt).toBeNull();
    clock.set("2026-11-26T12:00:00.000Z"); // Thursday
    await services.tasks.setStatus(t.id, "completed");

    const { completions, task } = (await services.tasks.getDetails(t.id))!;
    expect(completions).toEqual([
      expect.objectContaining({
        completedAt: "2026-11-23T12:00:00.000Z",
        completedOn: toLocalDate(new Date("2026-11-23T12:00:00.000Z")),
        reopenedAt: "2026-11-24T12:00:00.000Z",
      }),
      expect.objectContaining({ completedAt: "2026-11-26T12:00:00.000Z", reopenedAt: null }),
    ]);
    expect(task.completedAt).toBe("2026-11-26T12:00:00.000Z");
    expect(await events(t.id)).toEqual(["created", "completed", "reopened", "completed"]);
  });

  it("sums several In Progress stretches and flags an ongoing one", async () => {
    const t = await services.tasks.create({ title: "x" });
    await services.tasks.setStatus(t.id, "in_progress");
    clock.advance(HOUR);
    await services.tasks.setStatus(t.id, "todo");
    clock.advance(DAY);
    await services.tasks.setStatus(t.id, "in_progress");
    clock.advance(30 * 60_000);

    const { statusDurations } = (await services.tasks.getDetails(t.id))!;
    expect(statusDurations).toEqual({
      inProgressMs: HOUR + 30 * 60_000,
      inProgressOngoing: true,
      inProgressStretches: 2,
    });
  });

  it("treats leaving Cancelled as a reopen and ignores no-op changes", async () => {
    const t = await services.tasks.create({ title: "x" });
    await services.tasks.setStatus(t.id, "cancelled");
    await services.tasks.setStatus(t.id, "cancelled");
    await services.tasks.setStatus(t.id, "todo");
    expect(await events(t.id)).toEqual(["created", "cancelled", "reopened"]);
    expect((await services.tasks.getDetails(t.id))!.completions).toHaveLength(0);
  });
});

describe("subtasks", () => {
  it("creates subtasks under a parent, inheriting its project, and logs on the parent", async () => {
    const project = await services.projects.create({ name: "Move house" });
    const parent = await services.tasks.create({ title: "Pack", projectId: project.id });
    const sub = await services.tasks.addSubtask(parent.id, "Kitchen");

    expect(sub).toMatchObject({ parentId: parent.id, projectId: project.id });
    expect(await events(parent.id)).toEqual(["created", "subtask_added"]);
    await expect(services.tasks.addSubtask(sub.id, "Too deep")).rejects.toBeInstanceOf(
      ValidationError,
    );

    // Top-level lists exclude subtasks; the parent shows their progress.
    const list = await services.tasks.list();
    expect(list.map((t) => t.id)).toEqual([parent.id]);
    await services.tasks.setStatus(sub.id, "completed");
    expect(await services.tasks.list()).toEqual([
      expect.objectContaining({ subtaskCount: 1, subtaskDoneCount: 1 }),
    ]);
    expect((await services.tasks.getDetails(parent.id))!.subtasks.map((s) => s.title)).toEqual([
      "Kitchen",
    ]);
  });

  it("moves subtasks along when the parent changes project, and forbids moving them alone", async () => {
    const a = await services.projects.create({ name: "A" });
    const b = await services.projects.create({ name: "B" });
    const parent = await services.tasks.create({ title: "P", projectId: a.id });
    const sub = await services.tasks.addSubtask(parent.id, "S");

    await expect(services.tasks.update(sub.id, { projectId: b.id })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await services.tasks.update(parent.id, { projectId: b.id });
    expect((await services.tasks.get(sub.id))?.projectId).toBe(b.id);
    expect(await events(sub.id)).toContain("project_changed");
  });

  it("soft-deletes a task with its subtasks, keeps history, and restores them together", async () => {
    const parent = await services.tasks.create({ title: "P" });
    const sub = await services.tasks.addSubtask(parent.id, "S");
    await services.tasks.setStatus(parent.id, "completed");

    await services.tasks.delete(parent.id);
    expect(await services.tasks.get(parent.id)).toBeNull();
    expect(await services.tasks.get(sub.id)).toBeNull();
    expect(await services.tasks.list()).toHaveLength(0);
    // History survives deletion.
    expect(await db.select("SELECT id FROM completion_events")).toHaveLength(1);
    expect(await events(parent.id)).toContain("deleted");

    await expect(services.tasks.restore(sub.id)).rejects.toBeInstanceOf(ValidationError);
    await services.tasks.restore(parent.id);
    expect(await services.tasks.get(sub.id)).not.toBeNull();
    expect(await events(parent.id)).toContain("restored");
  });

  it("deleting one subtask logs the removal on the parent", async () => {
    const parent = await services.tasks.create({ title: "P" });
    const sub = await services.tasks.addSubtask(parent.id, "S");
    await services.tasks.delete(sub.id);
    expect(await events(parent.id)).toEqual(["created", "subtask_added", "subtask_removed"]);
  });
});

describe("archiving", () => {
  it("hides archived tasks from default lists without losing them", async () => {
    const t = await services.tasks.create({ title: "Old" });
    await services.tasks.archive(t.id);
    expect(await services.tasks.list()).toHaveLength(0);
    expect(await services.tasks.list({ includeArchived: true })).toHaveLength(1);
    await services.tasks.unarchive(t.id);
    expect(await services.tasks.list()).toHaveLength(1);
    expect(await events(t.id)).toEqual(["created", "archived", "unarchived"]);
  });
});

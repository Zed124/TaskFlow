import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import type { Database } from "@/db/executor";
import { smartFilters } from "@/domain/smart-lists";
import { ValidationError } from "@/lib/errors";
import type { createFixedClock } from "@/lib/time";
import { createTestServices, DAY, HOUR } from "@/test/test-services";

let services: Services;
let clock: ReturnType<typeof createFixedClock>;
let db: Database;

// Local noon, so local-date arithmetic is unambiguous in any time zone.
const NOW = new Date(2026, 10, 26, 12, 0);

beforeEach(async () => {
  ({ services, clock, db } = await createTestServices(NOW.toISOString()));
});

const titles = (list: { title: string }[]) => list.map((t) => t.title);

describe("board moves", () => {
  async function column(status: "todo" | "in_progress") {
    return services.tasks.list({ statuses: [status], sort: { field: "manual", direction: "asc" } });
  }

  it("reorders within a column by writing a single fractional sort order", async () => {
    const a = await services.tasks.create({ title: "A" });
    const b = await services.tasks.create({ title: "B" });
    const c = await services.tasks.create({ title: "C" });
    expect(titles(await column("todo"))).toEqual(["A", "B", "C"]);

    await services.tasks.move(c.id, { status: "todo", orderedIds: [a.id, c.id, b.id] });
    expect(titles(await column("todo"))).toEqual(["A", "C", "B"]);
    await services.tasks.move(b.id, { status: "todo", orderedIds: [b.id, a.id, c.id] });
    expect(titles(await column("todo"))).toEqual(["B", "A", "C"]);

    // Pure reorders are not history-worthy: no new activity events.
    expect((await services.activity.listForTask(c.id)).map((e) => e.eventType)).toEqual([
      "created",
    ]);
  });

  it("moving to another column is a real status change with history", async () => {
    const a = await services.tasks.create({ title: "A" });
    const b = await services.tasks.create({ title: "B" });
    await services.tasks.setStatus(b.id, "in_progress");
    clock.advance(HOUR);

    await services.tasks.move(a.id, { status: "in_progress", orderedIds: [a.id, b.id] });

    expect(titles(await column("in_progress"))).toEqual(["A", "B"]);
    expect((await services.activity.listForTask(a.id)).at(-1)).toMatchObject({
      eventType: "status_changed",
      payload: { from: "todo", to: "in_progress" },
    });
    const details = await services.tasks.getDetails(a.id);
    expect(details?.intervals.map((i) => i.status)).toEqual(["todo", "in_progress"]);
  });

  it("renumbers the column when the fractional gap runs out", async () => {
    const a = await services.tasks.create({ title: "A" });
    const b = await services.tasks.create({ title: "B" });
    const c = await services.tasks.create({ title: "C" });
    await db.execute("UPDATE tasks SET sort_order = 1 WHERE id IN (?, ?)", [a.id, b.id]);

    await services.tasks.move(c.id, { status: "todo", orderedIds: [a.id, c.id, b.id] });
    expect(titles(await column("todo"))).toEqual(["A", "C", "B"]);
    const orders = await db.select<{ sort_order: number }>(
      "SELECT sort_order FROM tasks ORDER BY sort_order",
    );
    expect(orders.map((r) => r.sort_order)).toEqual([1, 2, 3]);
  });

  it("rejects a move whose order does not contain the task", async () => {
    const a = await services.tasks.create({ title: "A" });
    await expect(
      services.tasks.move(a.id, { status: "todo", orderedIds: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("smart lists", () => {
  it("splits tasks into overdue, today, upcoming and completed-today", async () => {
    const f = smartFilters(NOW);
    await services.tasks.create({ title: "Late", dueDate: "2026-11-20" });
    await services.tasks.create({ title: "Today", dueDate: "2026-11-26" });
    await services.tasks.create({ title: "Soon", dueDate: "2026-11-28" });
    await services.tasks.create({ title: "Undated" });
    const done = await services.tasks.create({ title: "Finished", dueDate: "2026-11-20" });
    await services.tasks.setStatus(done.id, "completed");

    expect(titles(await services.tasks.list(f.overdue))).toEqual(["Late"]);
    expect(titles(await services.tasks.list(f.dueToday))).toEqual(["Today"]);
    expect(titles(await services.tasks.list(f.upcoming))).toEqual(["Soon"]);
    expect(titles(await services.tasks.list(f.completedToday))).toEqual(["Finished"]);

    clock.advance(DAY);
    expect(
      titles(await services.tasks.list(smartFilters(new Date(NOW.getTime() + DAY)).completedToday)),
    ).toEqual([]);
  });
});

describe("timeline window", () => {
  it("includes tasks due or completed in the window, and anything in progress", async () => {
    await services.tasks.create({ title: "Due inside", dueDate: "2026-12-02" });
    await services.tasks.create({ title: "Due outside", dueDate: "2027-02-01" });
    const wip = await services.tasks.create({ title: "Working" });
    await services.tasks.setStatus(wip.id, "in_progress");
    const done = await services.tasks.create({ title: "Done today" });
    await services.tasks.setStatus(done.id, "completed");
    await services.tasks.create({ title: "Undated idle" });

    const list = await services.tasks.listTimeline("2026-11-23", "2026-12-20");
    expect(titles(list).sort()).toEqual(["Done today", "Due inside", "Working"]);
  });
});

describe("dashboard stats", () => {
  it("counts open work and distinct daily completions", async () => {
    await services.tasks.create({ title: "late", dueDate: "2026-11-01" });
    await services.tasks.create({ title: "today", dueDate: "2026-11-26" });
    const wip = await services.tasks.create({ title: "wip" });
    await services.tasks.setStatus(wip.id, "in_progress");

    // Completed twice today (reopened in between) counts once.
    const x = await services.tasks.create({ title: "x" });
    await services.tasks.setStatus(x.id, "completed");
    await services.tasks.setStatus(x.id, "todo");
    await services.tasks.setStatus(x.id, "completed");
    // Subtask completions are not counted as tasks.
    const sub = await services.tasks.addSubtask(wip.id, "sub");
    await services.tasks.setStatus(sub.id, "completed");
    // Completed two days ago.
    clock.set(new Date(NOW.getTime() - 2 * DAY).toISOString());
    const y = await services.tasks.create({ title: "y" });
    await services.tasks.setStatus(y.id, "completed");
    clock.set(NOW.toISOString());

    const stats = await services.stats.dashboard(1, 7);
    expect(stats).toMatchObject({
      today: "2026-11-26",
      open: 3,
      inProgress: 1,
      overdue: 1,
      dueToday: 1,
      completedToday: 1,
    });
    expect(stats.lastDays).toHaveLength(7);
    expect(stats.lastDays.at(-1)).toEqual({ date: "2026-11-26", completed: 1 });
    expect(stats.lastDays.at(-3)).toEqual({ date: "2026-11-24", completed: 1 });
    // Week starts Monday Nov 23 → both completions are this week.
    expect(stats.completedThisWeek).toBe(2);
  });
});

describe("bulk archiving", () => {
  it("archives completed tasks (optionally only older ones) and can undo it in one step", async () => {
    const old = await services.tasks.create({ title: "Old done" });
    await services.tasks.setStatus(old.id, "completed");
    clock.advance(10 * DAY);
    const recent = await services.tasks.create({ title: "Recent done" });
    await services.tasks.setStatus(recent.id, "completed");
    await services.tasks.create({ title: "Still open" });

    const cutoff = new Date(clock.now().getTime() - 7 * DAY).toISOString() as never;
    const archived = await services.tasks.archiveCompleted({ completedBefore: cutoff });
    expect(archived).toEqual([old.id]);
    expect(titles(await services.tasks.list({ statuses: ["completed"] }))).toEqual(["Recent done"]);

    const all = await services.tasks.archiveCompleted();
    expect(all).toEqual([recent.id]);
    await services.tasks.unarchiveMany([...archived, ...all]);
    expect(
      titles(
        await services.tasks.list({
          statuses: ["completed"],
          sort: { field: "title", direction: "asc" },
        }),
      ),
    ).toEqual(["Old done", "Recent done"]);
    // History keeps the whole story.
    expect((await services.activity.listForTask(old.id)).map((e) => e.eventType)).toEqual([
      "created",
      "completed",
      "archived",
      "unarchived",
    ]);
  });
});

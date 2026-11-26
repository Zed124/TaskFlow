/**
 * Performance check at scale (10,000 tasks with history). Skipped in normal test runs;
 * run with:  npm run perf
 * Prints timings for the hot paths and EXPLAIN QUERY PLAN output, and asserts that the main
 * task queries are index-driven (timings are reported, not asserted: they vary by machine).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createServices, type Services } from "@/app/services";
import type { Database, SqlValue } from "@/db/executor";
import { buildTaskWhere } from "@/db/repositories/task-repository";
import { smartFilters } from "@/domain/smart-lists";
import { presetRange } from "@/domain/analytics";
import { createTestDb } from "@/test/test-db";
import { seedLargeDataset } from "./seed";

const RUN = process.env.PERF === "1";
const TASKS = Number(process.env.PERF_TASKS ?? 10_000);

describe.skipIf(!RUN)(`performance with ${TASKS} tasks`, () => {
  let db: Database;
  let services: Services;
  const timings: [string, number, number][] = [];

  async function time<T>(label: string, work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await work();
    const ms = performance.now() - start;
    timings.push([label, Math.round(ms * 10) / 10, Array.isArray(result) ? result.length : -1]);
    return result;
  }

  beforeAll(async () => {
    db = await createTestDb();
    const t0 = performance.now();
    await seedLargeDataset(db, { tasks: TASKS });
    console.log(`seeded ${TASKS} tasks in ${Math.round(performance.now() - t0)} ms`);
    services = createServices(db);
    await db.executeBatch("ANALYZE");
  }, 120_000);

  it("measures the hot paths", async () => {
    const f = smartFilters(new Date());
    await time("All tasks (default, newest first)", () =>
      services.tasks.list({ sort: { field: "created", direction: "desc" } }),
    );
    await time("All tasks sorted by due date", () =>
      services.tasks.list({ sort: { field: "due", direction: "asc" } }),
    );
    await time("Filter: status+priority", () =>
      services.tasks.list({ statuses: ["todo", "in_progress"], priorities: ["high", "urgent"] }),
    );
    await time("Filter: text 'invoice'", () => services.tasks.list({ text: "invoice" }));
    await time("My Day: overdue", () => services.tasks.list(f.overdue));
    await time("My Day: due today", () => services.tasks.list(f.dueToday));
    await time("Upcoming", () => services.tasks.list(f.upcoming));
    await time("Completed", () => services.tasks.list(f.completed));
    await time("Board (manual order)", () =>
      services.tasks.list({ sort: { field: "manual", direction: "asc" } }),
    );
    await time("Global search 'report'", () => services.search.search("report"));
    await time("Dashboard stats", () => services.stats.dashboard(1, 14));
    await time("Analytics 12 months", () =>
      services.analytics.report(presetRange("12m", new Date()), "month", 1),
    );
    await time("Analytics 30 days", () =>
      services.analytics.report(presetRange("30d", new Date()), "day", 1),
    );
    await time("Projects with progress", () => services.projects.list({ includeArchived: true }));
    await time("Categories with counts", () => services.categories.list());
    await time("Activity feed page", () => services.activity.feed());
    const someTask = (await services.tasks.list({ limit: 1 }))[0];
    if (someTask) await time("Task details", () => services.tasks.getDetails(someTask.id));
    await time("Backup export", () => services.backup.exportDocument());
    await time("CSV export", () => services.backup.exportTasksCsv());
    console.table(
      timings.map(([label, ms, rows]) => ({ query: label, ms, rows: rows < 0 ? "" : rows })),
    );
  }, 120_000);

  it("uses indexes for the main task filters", async () => {
    const plan = async (sql: string, params: readonly SqlValue[]) =>
      (await db.select<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params)).map(
        (r) => r.detail,
      );

    const today = new Date().toISOString().slice(0, 10);
    const cases: [string, Parameters<typeof buildTaskWhere>[0]][] = [
      ["overdue", { statuses: ["todo", "in_progress"], due: { to: today as never } }],
      ["by project", { projectIds: ["x"] }],
      ["by category", { categoryIds: ["x"] }],
      ["subtasks of a task", { parentId: "x" }],
    ];
    for (const [label, filter] of cases) {
      const { where, params } = buildTaskWhere(filter);
      const details = await plan(
        `SELECT t.id FROM tasks t LEFT JOIN categories c ON c.id = t.category_id ${where}`,
        params,
      );
      console.log(label, "→", details.join(" | "));
      expect(
        details.some((d) => /SEARCH t USING (COVERING )?INDEX/.test(d)),
        `${label} should use an index`,
      ).toBe(true);
      expect(
        details.some((d) => /^SCAN t\b/.test(d)),
        `${label} must not scan all tasks`,
      ).toBe(false);
    }
  });
});

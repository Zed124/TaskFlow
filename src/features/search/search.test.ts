import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import { NONE } from "@/domain/task-filter";
import { toFtsQuery } from "@/db/sql";
import { HIT_END, HIT_START } from "@/db/repositories/search-repository";
import { createTestServices, MINUTE } from "@/test/test-services";
import type { createFixedClock } from "@/lib/time";

let services: Services;
let clock: ReturnType<typeof createFixedClock>;

beforeEach(async () => {
  ({ services, clock } = await createTestServices());
});

async function seed() {
  const work = await services.projects.create({ name: "Work" });
  const health = await services.categories.create({ name: "Health" });
  const make = async (
    title: string,
    extra: Parameters<Services["tasks"]["create"]>[0] = { title },
  ) => {
    clock.advance(MINUTE);
    return services.tasks.create({ ...extra, title });
  };
  const report = await make("Quarterly report", {
    title: "",
    projectId: work.id,
    priority: "high",
    dueDate: "2026-12-01",
    description: "Revenue figures",
  });
  const dentist = await make("Dentist", {
    title: "",
    categoryId: health.id,
    dueDate: "2026-11-25",
    priority: "urgent",
  });
  const groceries = await make("Groceries", { title: "", priority: "low" });
  const run = await make("Morning run", {
    title: "",
    categoryId: health.id,
    dueDate: "2026-12-10",
  });
  await services.tasks.setStatus(run.id, "completed");
  await services.activity.addNote(groceries.id, "Remember oat milk");
  return { work, health, report, dentist, groceries, run };
}

describe("task filters", () => {
  it("filters by status, priority, project (including none), category and due range", async () => {
    const s = await seed();
    const titles = async (f: Parameters<Services["tasks"]["list"]>[0]) =>
      (await services.tasks.list({ ...f, sort: { field: "title", direction: "asc" } })).map(
        (t) => t.title,
      );

    expect(await titles({ statuses: ["completed"] })).toEqual(["Morning run"]);
    expect(
      await titles({ statuses: ["todo", "in_progress"], priorities: ["urgent", "high"] }),
    ).toEqual(["Dentist", "Quarterly report"]);
    expect(await titles({ projectIds: [s.work.id] })).toEqual(["Quarterly report"]);
    expect(await titles({ projectIds: [NONE] })).toEqual(["Dentist", "Groceries", "Morning run"]);
    expect(await titles({ categoryIds: [s.health.id] })).toEqual(["Dentist", "Morning run"]);
    expect(await titles({ categoryIds: [NONE] })).toEqual(["Groceries", "Quarterly report"]);
    expect(
      await titles({ due: { from: "2026-11-26" as never, to: "2026-12-05" as never } }),
    ).toEqual(["Quarterly report"]);
    expect(await titles({ due: { none: true } })).toEqual(["Groceries"]);
  });

  it("matches free text in titles, descriptions and timeline notes", async () => {
    await seed();
    const find = async (text: string) => (await services.tasks.list({ text })).map((t) => t.title);
    expect(await find("revenue")).toEqual(["Quarterly report"]);
    expect(await find("oat")).toEqual(["Groceries"]); // found through its note
    expect(await find("quart rep")).toEqual(["Quarterly report"]); // prefix matching, all tokens
    expect(await find("nothing-like-this")).toEqual([]);
  });

  it("sorts by due date with undated tasks last in both directions", async () => {
    await seed();
    for (const direction of ["asc", "desc"] as const) {
      const list = await services.tasks.list({ sort: { field: "due", direction } });
      expect(list.at(-1)?.title).toBe("Groceries");
    }
    const asc = await services.tasks.list({ sort: { field: "due", direction: "asc" } });
    expect(asc.map((t) => t.title).slice(0, 3)).toEqual([
      "Dentist",
      "Quarterly report",
      "Morning run",
    ]);
  });

  it("sorts by priority, most important first", async () => {
    await seed();
    const list = await services.tasks.list({ sort: { field: "priority", direction: "desc" } });
    expect(list.map((t) => t.priority)).toEqual(["urgent", "high", "medium", "low"]);
  });
});

describe("global search", () => {
  it("finds tasks, projects, categories and notes with highlighted matches", async () => {
    await seed();
    await services.projects.create({ name: "Health insurance" });

    const hits = await services.search.search("health");
    expect(hits.map((h) => h.kind).sort()).toEqual(["category", "project"]);
    expect(hits.find((h) => h.kind === "project")?.title).toBe(
      `${HIT_START}Health${HIT_END} insurance`,
    );

    const note = (await services.search.search("milk")).find((h) => h.kind === "note");
    expect(note).toMatchObject({ kind: "note", taskTitle: "Groceries" });
  });

  it("excludes deleted tasks and their notes", async () => {
    const { groceries } = await seed();
    await services.tasks.delete(groceries.id);
    expect(await services.search.search("groceries")).toEqual([]);
    expect(await services.search.search("milk")).toEqual([]);
  });

  it("treats query syntax as plain text", async () => {
    await seed();
    for (const q of ['"', "AND", "OR NOT", "dentist)", "NEAR(", "*", "-"]) {
      await expect(services.search.search(q)).resolves.toBeInstanceOf(Array);
    }
    expect(toFtsQuery('say "hi" now')).toBe('"say"* "hi"* "now"*');
    expect(toFtsQuery("   ")).toBeNull();
  });
});

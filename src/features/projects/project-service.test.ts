import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import { ValidationError } from "@/lib/errors";
import { createTestServices } from "@/test/test-services";

let services: Services;

beforeEach(async () => {
  ({ services } = await createTestServices());
});

describe("projects", () => {
  it("derives progress from top-level tasks, excluding cancelled ones from the total", async () => {
    const p = await services.projects.create({ name: "Launch" });
    const a = await services.tasks.create({ title: "a", projectId: p.id });
    const b = await services.tasks.create({ title: "b", projectId: p.id });
    const c = await services.tasks.create({ title: "c", projectId: p.id });
    await services.tasks.create({ title: "d", projectId: p.id });
    await services.tasks.addSubtask(a.id, "sub (not counted)");
    await services.tasks.setStatus(a.id, "completed");
    await services.tasks.setStatus(b.id, "in_progress");
    await services.tasks.setStatus(c.id, "cancelled");

    const loaded = await services.projects.get(p.id);
    expect(loaded?.progress).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      open: 1,
      cancelled: 1,
    });
  });

  it("validates input and records field changes", async () => {
    await expect(services.projects.create({ name: " " })).rejects.toBeInstanceOf(ValidationError);
    const p = await services.projects.create({ name: "Garden" });
    await services.projects.update(p.id, { name: "Garden 2027", description: "Raised beds" });
    const history = await services.activity.listForProject(p.id);
    expect(history.map((e) => e.eventType)).toEqual(["created", "field_changed", "field_changed"]);
  });

  it("archives without touching tasks", async () => {
    const p = await services.projects.create({ name: "Old" });
    const t = await services.tasks.create({ title: "t", projectId: p.id });
    await services.projects.archive(p.id);

    expect(await services.projects.list()).toHaveLength(0);
    expect(await services.projects.list({ includeArchived: true })).toHaveLength(1);
    expect((await services.tasks.get(t.id))?.projectId).toBe(p.id);
  });

  it("deleting a project detaches its tasks (and subtasks) and records it on each", async () => {
    const p = await services.projects.create({ name: "Temp" });
    const t = await services.tasks.create({ title: "t", projectId: p.id });
    const s = await services.tasks.addSubtask(t.id, "s");
    await services.projects.delete(p.id);

    expect(await services.projects.get(p.id)).toBeNull();
    for (const id of [t.id, s.id]) {
      expect((await services.tasks.get(id))?.projectId).toBeNull();
      const last = (await services.activity.listForTask(id)).at(-1);
      expect(last).toMatchObject({
        eventType: "project_changed",
        payload: { from: { name: "Temp" }, to: null },
      });
    }
  });
});

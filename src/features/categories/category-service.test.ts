import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import { ConflictError } from "@/lib/errors";
import { createTestServices } from "@/test/test-services";

let services: Services;

beforeEach(async () => {
  ({ services } = await createTestServices());
});

describe("categories", () => {
  it("enforces unique names (case-insensitive) on create and rename", async () => {
    const work = await services.categories.create({ name: "Work" });
    await expect(services.categories.create({ name: "work" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    const home = await services.categories.create({ name: "Home" });
    await expect(services.categories.update(home.id, { name: "WORK" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    await services.categories.update(work.id, { name: "Work stuff" });
    expect((await services.categories.list()).map((c) => c.name)).toEqual(["Work stuff", "Home"]);
  });

  it("counts open and total tasks", async () => {
    const c = await services.categories.create({ name: "Health" });
    const a = await services.tasks.create({ title: "a", categoryId: c.id });
    await services.tasks.create({ title: "b", categoryId: c.id });
    await services.tasks.setStatus(a.id, "completed");
    expect(await services.categories.list()).toEqual([
      expect.objectContaining({ taskCount: 2, openTaskCount: 1 }),
    ]);
  });

  it("deleting a category clears it from tasks with a history event, and frees the name", async () => {
    const c = await services.categories.create({ name: "Temp" });
    const t = await services.tasks.create({ title: "t", categoryId: c.id });
    await services.categories.delete(c.id);

    expect((await services.tasks.get(t.id))?.categoryId).toBeNull();
    expect((await services.activity.listForTask(t.id)).at(-1)).toMatchObject({
      eventType: "category_changed",
      payload: { from: { name: "Temp" }, to: null },
    });
    await expect(services.categories.create({ name: "Temp" })).resolves.toBeDefined();
  });
});

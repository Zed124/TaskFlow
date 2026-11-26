import { describe, expect, it } from "vitest";
import { parseQuickAdd, type QuickAddContext } from "./quick-add";

const ctx: QuickAddContext = {
  today: new Date(2026, 10, 26, 10, 0), // Thursday, Nov 26 2026
  projects: [
    { id: "p1", name: "Finance" },
    { id: "p2", name: "Home Renovation" },
  ],
  categories: [
    { id: "c1", name: "Health" },
    { id: "c2", name: "Deep work" },
  ],
};

describe("parseQuickAdd", () => {
  it("returns plain text as the title", () => {
    expect(parseQuickAdd("  Buy milk  ", ctx)).toMatchObject({
      title: "Buy milk",
      dueDate: null,
      priority: null,
      projectId: null,
      tokens: [],
    });
  });

  it("extracts date, time, priority, project and category from anywhere in the text", () => {
    const r = parseQuickAdd("Send report tomorrow 14:30 !high @finance #deep-work", ctx);
    expect(r).toMatchObject({
      title: "Send report",
      dueDate: "2026-11-27",
      dueTime: "14:30",
      priority: "high",
      projectId: "p1",
      categoryId: "c2",
    });
    expect(r.tokens.map((t) => [t.kind, t.label])).toEqual([
      ["due", "2026-11-27"],
      ["time", "14:30"],
      ["priority", "high"],
      ["project", "Finance"],
      ["category", "Deep work"],
    ]);
  });

  it("understands weekdays, relative offsets, ISO dates and 12-hour times", () => {
    expect(parseQuickAdd("x mon", ctx).dueDate).toBe("2026-11-30");
    expect(parseQuickAdd("x thu", ctx).dueDate).toBe("2026-12-03"); // today is Thursday → next week
    expect(parseQuickAdd("x +3d", ctx).dueDate).toBe("2026-11-29");
    expect(parseQuickAdd("x +2w", ctx).dueDate).toBe("2026-12-10");
    expect(parseQuickAdd("x 2027-01-15", ctx).dueDate).toBe("2027-01-15");
    expect(parseQuickAdd("x 2026-02-30", ctx).dueDate).toBeNull();
    expect(parseQuickAdd("x 5pm", ctx)).toMatchObject({ dueDate: "2026-11-26", dueTime: "17:00" });
    expect(parseQuickAdd("x 12am", ctx).dueTime).toBe("00:00");
    expect(parseQuickAdd("x 9:15am", ctx).dueTime).toBe("09:15");
  });

  it("matches projects by prefix and ignores spacing in names", () => {
    expect(parseQuickAdd("Paint @homereno", ctx).projectId).toBe("p2");
    expect(parseQuickAdd("Paint @home_renovation", ctx).projectId).toBe("p2");
  });

  it("keeps unknown references in the title and reports them", () => {
    const r = parseQuickAdd("Call @nobody about #stuff", ctx);
    expect(r.title).toBe("Call @nobody about #stuff");
    expect(r.unmatched).toEqual([
      { index: 1, raw: "@nobody", kind: "project" },
      { index: 3, raw: "#stuff", kind: "category" },
    ]);
  });

  it("only uses the first token of each kind; later ones stay in the title", () => {
    const r = parseQuickAdd("Meet today or tomorrow !low !urgent", ctx);
    expect(r).toMatchObject({
      title: "Meet or tomorrow !urgent",
      dueDate: "2026-11-26",
      priority: "low",
    });
  });

  it("lets the user opt a word out of parsing", () => {
    const r = parseQuickAdd("Read Monday notes", ctx, new Set([1]));
    expect(r).toMatchObject({ title: "Read Monday notes", dueDate: null });
  });
});

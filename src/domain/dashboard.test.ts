import { describe, expect, it } from "vitest";
import { DASHBOARD_WIDGETS, moveWidget, normalizeLayout } from "./dashboard";

describe("dashboard layout", () => {
  it("adds missing widgets and removes duplicates", () => {
    const layout = normalizeLayout([
      { id: "today", visible: false },
      { id: "today", visible: true },
      { id: "stats", visible: true },
    ]);
    expect(layout.slice(0, 2)).toEqual([
      { id: "today", visible: false },
      { id: "stats", visible: true },
    ]);
    expect(layout.map((w) => w.id).sort()).toEqual([...DASHBOARD_WIDGETS].sort());
  });

  it("moves widgets within bounds", () => {
    const layout = normalizeLayout([]);
    expect(
      moveWidget(layout, "quickAdd", -1)
        .map((w) => w.id)
        .slice(0, 2),
    ).toEqual(["quickAdd", "stats"]);
    expect(moveWidget(layout, "stats", -1)).toBe(layout);
    expect(moveWidget(layout, "recentlyCompleted", 1)).toBe(layout);
  });
});

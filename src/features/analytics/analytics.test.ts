import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import {
  bucketsInRange,
  bucketStart,
  median,
  presetRange,
  splitByLocalDay,
} from "@/domain/analytics";
import type { LocalDate, createFixedClock } from "@/lib/time";
import { createTestServices, DAY, HOUR, MINUTE } from "@/test/test-services";

const d = (s: string) => s as LocalDate;

describe("analytics date math", () => {
  it("buckets by day, week (respecting week start) and month", () => {
    expect(bucketStart(d("2026-11-26"), "week", 1)).toBe("2026-11-23"); // Monday
    expect(bucketStart(d("2026-11-26"), "week", 0)).toBe("2026-11-22"); // Sunday
    expect(bucketStart(d("2026-11-26"), "week", 6)).toBe("2026-11-21"); // Saturday
    expect(bucketStart(d("2026-11-26"), "month", 1)).toBe("2026-11-01");
    expect(bucketsInRange({ from: d("2026-11-20"), to: d("2026-12-02") }, "week", 1)).toEqual([
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  it("builds preset ranges ending today", () => {
    const now = new Date(2026, 10, 26, 12);
    expect(presetRange("7d", now)).toEqual({ from: "2026-11-20", to: "2026-11-26" });
    expect(presetRange("12m", now)).toEqual({ from: "2025-12-01", to: "2026-11-26" });
  });

  it("splits time across local midnight", () => {
    const parts = splitByLocalDay(new Date(2026, 10, 25, 23, 30), new Date(2026, 10, 26, 0, 45));
    expect(Object.fromEntries(parts)).toEqual({
      "2026-11-25": 30 * MINUTE,
      "2026-11-26": 45 * MINUTE,
    });
  });

  it("computes medians", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("analytics report", () => {
  let services: Services;
  let clock: ReturnType<typeof createFixedClock>;
  const MON = new Date(2026, 10, 23, 9, 0); // Monday 09:00 local

  beforeEach(async () => {
    ({ services, clock } = await createTestServices(MON.toISOString()));
  });

  it("separates lead time, status duration and tracked work, and counts per period", async () => {
    const p = await services.projects.create({ name: "Work" });
    const a = await services.tasks.create({ title: "A", projectId: p.id, priority: "high" });
    const b = await services.tasks.create({ title: "B" });
    // A: in progress 2h, tracked 30m of actual work, completed Monday 11:00.
    await services.tasks.setStatus(a.id, "in_progress");
    await services.timer.start(a.id);
    clock.advance(30 * MINUTE);
    await services.timer.stop();
    clock.advance(90 * MINUTE);
    await services.tasks.setStatus(a.id, "completed");
    // A reopened and completed again Tuesday: still one task, and lead time uses the first completion.
    clock.advance(DAY);
    await services.tasks.setStatus(a.id, "todo");
    await services.tasks.setStatus(a.id, "completed");
    // B completed Wednesday without ever being in progress.
    clock.advance(DAY);
    await services.tasks.setStatus(b.id, "completed");

    const report = await services.analytics.report(
      { from: d("2026-11-23"), to: d("2026-11-29") },
      "day",
      1,
    );

    expect(report.totals.completed).toBe(2);
    expect(report.totals.created).toBe(2);
    expect(report.totals.trackedMs).toBe(30 * MINUTE);
    expect(report.totals.lead.sample).toBe(2);
    expect(report.totals.lead.medianMs).toBe((2 * HOUR + (2 * DAY + 2 * HOUR)) / 2);
    // Status duration only for tasks that were in progress (A: 2h); B is not averaged in as 0.
    expect(report.totals.inProgress).toMatchObject({ sample: 1, medianMs: 2 * HOUR, ongoing: 0 });

    expect(report.trend.map((t) => [t.key, t.completed, t.created, t.trackedMs])).toEqual([
      ["2026-11-23", 1, 2, 30 * MINUTE],
      ["2026-11-24", 1, 0, 0],
      ["2026-11-25", 1, 0, 0],
      ["2026-11-26", 0, 0, 0],
      ["2026-11-27", 0, 0, 0],
      ["2026-11-28", 0, 0, 0],
      ["2026-11-29", 0, 0, 0],
    ]);

    // A week bucket counts A once even though it was completed on two days.
    const weekly = await services.analytics.report(
      { from: d("2026-11-23"), to: d("2026-11-29") },
      "week",
      1,
    );
    expect(weekly.trend).toEqual([expect.objectContaining({ key: "2026-11-23", completed: 2 })]);

    expect(report.byPriority.find((x) => x.priority === "high")).toMatchObject({
      completed: 1,
      open: 0,
    });
    expect(report.projects.find((x) => x.id === p.id)).toMatchObject({
      completed: 1,
      trackedMs: 30 * MINUTE,
    });
    expect(report.projects.find((x) => x.id === null)).toMatchObject({
      completed: 1,
      trackedMs: 0,
    });
  });
});

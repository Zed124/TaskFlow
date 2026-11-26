import { describe, expect, it } from "vitest";
import type { LocalDate } from "@/lib/time";
import { planNotifications, type NotifiableTask, type NotificationPrefs } from "./notifications";

const prefs: NotificationPrefs = {
  enabled: true,
  reminders: true,
  reminderLeadMinutes: 15,
  dailyDigest: true,
  digestTime: "09:00",
  overdue: true,
};
const task = (id: string, dueDate: string, dueTime: string | null = null): NotifiableTask => ({
  id,
  title: `Task ${id}`,
  dueDate: dueDate as LocalDate,
  dueTime,
});
const at = (h: number, m = 0, day = 26) => new Date(2026, 10, day, h, m);
// Each test looks at one kind of notification; the digest is opted in where it is the subject.
const only = { ...prefs, dailyDigest: false };
const plan = (now: Date, tasks: NotifiableTask[], sent: string[] = [], p = only) =>
  planNotifications({ now, prefs: p, tasks, sent: new Set(sent) });

describe("planNotifications", () => {
  it("sends nothing when disabled", () => {
    expect(
      plan(at(13, 50), [task("a", "2026-11-26", "14:00")], [], { ...prefs, enabled: false }),
    ).toEqual([]);
  });

  it("reminds at due time minus lead, only inside the grace window, once", () => {
    const t = [task("a", "2026-11-26", "14:00")];
    expect(plan(at(13, 44), t)).toEqual([]);
    const fired = plan(at(13, 45), t);
    expect(fired).toEqual([
      expect.objectContaining({ kind: "reminder", taskId: "a", body: "Due at 14:00" }),
    ]);
    expect(
      plan(
        at(13, 50),
        t,
        fired.flatMap((f) => f.dedupeKeys),
      ),
    ).toEqual([]);
    // App was closed through the reminder: no stale reminder much later.
    expect(plan(at(14, 20), t).filter((n) => n.kind === "reminder")).toEqual([]);
  });

  it("re-reminds if the due time changes", () => {
    const sent = plan(at(13, 45), [task("a", "2026-11-26", "14:00")]).flatMap((f) => f.dedupeKeys);
    expect(plan(at(15, 45), [task("a", "2026-11-26", "16:00")], sent)).toHaveLength(1);
  });

  it("alerts once when a task becomes overdue, but not for long-overdue tasks", () => {
    const timed = [task("a", "2026-11-26", "14:00")];
    expect(plan(at(14, 5), timed, [], { ...only, reminders: false })).toEqual([
      expect.objectContaining({ kind: "overdue", taskId: "a" }),
    ]);
    // Date-only task becomes overdue at midnight after its due day.
    const dateOnly = [task("b", "2026-11-25")];
    expect(plan(at(0, 30), dateOnly, [], { ...prefs, dailyDigest: false })).toEqual([
      expect.objectContaining({ kind: "overdue", body: "Was due yesterday" }),
    ]);
    // Overdue for days: left to the digest, no individual alert.
    expect(plan(at(10), [task("c", "2026-11-20")], [], { ...prefs, dailyDigest: false })).toEqual(
      [],
    );
  });

  it("batches many new overdue tasks into one notification", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) => task(id, "2026-11-25"));
    const out = plan(at(0, 30), many, [], { ...prefs, dailyDigest: false });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "overdue_batch", title: "5 tasks are now overdue" });
    expect(out[0]?.dedupeKeys).toHaveLength(5);
    expect(out[0]?.body.split("\n")).toEqual(["• Task a", "• Task b", "• Task c", "+2 more"]);
  });

  it("sends one digest per day after the digest time, only when there is something to say", () => {
    const tasks = [task("a", "2026-11-26"), task("b", "2026-11-20")];
    const noOverdue = { ...prefs, dailyDigest: true, overdue: false };
    expect(plan(at(8, 59), tasks, [], noOverdue)).toEqual([]);
    expect(plan(at(9, 0), tasks, [], noOverdue)).toEqual([
      expect.objectContaining({ kind: "digest", title: "Today: 1 due today, 1 overdue" }),
    ]);
    expect(plan(at(15), tasks, ["digest:2026-11-26"], noOverdue)).toEqual([]);
    expect(plan(at(9), [], [], noOverdue)).toEqual([]);
  });
});

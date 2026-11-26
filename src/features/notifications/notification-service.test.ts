import { describe, expect, it } from "vitest";
import type { NotificationPrefs } from "@/domain/notifications";
import { createTestServices, MINUTE } from "@/test/test-services";

const prefs: NotificationPrefs = {
  enabled: true,
  reminders: true,
  reminderLeadMinutes: 15,
  dailyDigest: false,
  digestTime: "09:00",
  overdue: true,
};

describe("notification service", () => {
  it("delivers each notification once, even across restarts", async () => {
    const start = new Date(2026, 10, 26, 13, 0);
    const { services, clock, db } = await createTestServices(start.toISOString());
    await services.tasks.create({ title: "Call", dueDate: "2026-11-26", dueTime: "14:00" });
    await services.tasks.create({
      title: "Done one",
      dueDate: "2026-11-26",
      dueTime: "14:00",
      status: "completed",
    });

    expect(await services.notifications.collectDue(prefs)).toEqual([]);
    clock.advance(45 * MINUTE); // 13:45 → reminder window opens
    const first = await services.notifications.collectDue(prefs);
    expect(first.map((n) => [n.kind, n.title])).toEqual([["reminder", "Call"]]);
    expect(await services.notifications.collectDue(prefs)).toEqual([]);

    // A fresh service graph over the same DB (= app restart) does not repeat it.
    const { createServices } = await import("@/app/services");
    expect(await createServices(db, clock).notifications.collectDue(prefs)).toEqual([]);

    clock.advance(20 * MINUTE); // 14:05 → overdue
    expect((await services.notifications.collectDue(prefs)).map((n) => n.kind)).toEqual([
      "overdue",
    ]);
    expect(await db.select("SELECT dedupe_key FROM notification_log")).toHaveLength(2);
  });

  it("does nothing when notifications are off", async () => {
    const { services } = await createTestServices();
    await services.tasks.create({ title: "x", dueDate: "2026-11-01" });
    expect(await services.notifications.collectDue({ ...prefs, enabled: false })).toEqual([]);
  });
});

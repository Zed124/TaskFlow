import { beforeEach, describe, expect, it } from "vitest";
import { createServices, type Services } from "@/app/services";
import type { Database } from "@/db/executor";
import { ValidationError } from "@/lib/errors";
import type { createFixedClock } from "@/lib/time";
import { createTestServices, HOUR, MINUTE } from "@/test/test-services";

let services: Services;
let clock: ReturnType<typeof createFixedClock>;
let db: Database;

beforeEach(async () => {
  ({ services, clock, db } = await createTestServices());
});

describe("manual work timer", () => {
  it("tracks start → pause → resume → stop as one session made of segments", async () => {
    const t = await services.tasks.create({ title: "Write" });
    await services.timer.start(t.id);
    clock.advance(25 * MINUTE);
    await services.timer.pause();
    clock.advance(HOUR); // break: not tracked
    await services.timer.resume();
    clock.advance(10 * MINUTE);

    expect((await services.timer.active())?.elapsedMs).toBe(35 * MINUTE);
    expect(await services.timer.stop()).toBe(35 * MINUTE);
    expect(await services.timer.active()).toBeNull();

    const { sessions, trackedMs } = await services.timer.forTask(t.id);
    expect(trackedMs).toBe(35 * MINUTE);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ state: "stopped", durationMs: 35 * MINUTE });
    expect(sessions[0]?.segments).toHaveLength(2);
    expect((await services.activity.listForTask(t.id)).at(-1)).toMatchObject({
      eventType: "work_session_logged",
      payload: { durationMs: 35 * MINUTE, reason: "manual" },
    });
  });

  it("keeps several sessions per task and sums them", async () => {
    const t = await services.tasks.create({ title: "Write" });
    for (const minutes of [10, 20]) {
      await services.timer.start(t.id);
      clock.advance(minutes * MINUTE);
      await services.timer.stop();
      clock.advance(HOUR);
    }
    const summary = await services.timer.forTask(t.id);
    expect(summary.sessions.map((s) => s.durationMs)).toEqual([20 * MINUTE, 10 * MINUTE]);
    expect(summary.trackedMs).toBe(30 * MINUTE);
  });

  it("allows only one active timer: starting another task stops the first", async () => {
    const a = await services.tasks.create({ title: "A" });
    const b = await services.tasks.create({ title: "B" });
    await services.timer.start(a.id);
    clock.advance(5 * MINUTE);
    await services.timer.start(b.id);

    expect((await services.timer.forTask(a.id)).sessions[0]).toMatchObject({
      state: "stopped",
      durationMs: 5 * MINUTE,
    });
    expect((await services.timer.active())?.session.taskId).toBe(b.id);
    expect((await services.activity.listForTask(a.id)).at(-1)).toMatchObject({
      payload: { reason: "switched" },
    });
  });

  it("starting the paused task's timer again resumes it instead of creating a session", async () => {
    const t = await services.tasks.create({ title: "x" });
    await services.timer.start(t.id);
    clock.advance(MINUTE);
    await services.timer.pause();
    await services.timer.start(t.id);
    expect((await services.timer.active())?.session.state).toBe("running");
    expect((await services.timer.forTask(t.id)).sessions).toHaveLength(1);
  });

  it("survives an app restart: a new service instance sees the running timer", async () => {
    const t = await services.tasks.create({ title: "x" });
    await services.timer.start(t.id);
    clock.advance(2 * HOUR);
    const restarted = createServices(db, clock);
    expect((await restarted.timer.active())?.elapsedMs).toBe(2 * HOUR);
  });

  it("stops automatically when the task is completed or deleted", async () => {
    const a = await services.tasks.create({ title: "A" });
    await services.timer.start(a.id);
    clock.advance(MINUTE);
    await services.tasks.setStatus(a.id, "completed");
    expect(await services.timer.active()).toBeNull();
    expect((await services.activity.listForTask(a.id)).map((e) => e.eventType)).toContain(
      "work_session_logged",
    );

    const parent = await services.tasks.create({ title: "P" });
    const sub = await services.tasks.addSubtask(parent.id, "S");
    await services.timer.start(sub.id);
    await services.tasks.delete(parent.id);
    expect(await services.timer.active()).toBeNull();
  });

  it("rejects invalid transitions", async () => {
    const t = await services.tasks.create({ title: "x" });
    await expect(services.timer.pause()).rejects.toBeInstanceOf(ValidationError);
    await expect(services.timer.stop()).rejects.toBeInstanceOf(ValidationError);
    await services.tasks.setStatus(t.id, "completed");
    await expect(services.timer.start(t.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

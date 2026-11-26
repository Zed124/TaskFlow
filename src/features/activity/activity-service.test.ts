import { beforeEach, describe, expect, it } from "vitest";
import type { Services } from "@/app/services";
import { ValidationError } from "@/lib/errors";
import type { createFixedClock } from "@/lib/time";
import { createTestServices, MINUTE } from "@/test/test-services";

let services: Services;
let clock: ReturnType<typeof createFixedClock>;

beforeEach(async () => {
  ({ services, clock } = await createTestServices());
});

describe("activity", () => {
  it("adds user notes that are distinguishable from system events", async () => {
    const t = await services.tasks.create({ title: "x" });
    clock.advance(MINUTE);
    await services.activity.addNote(t.id, "  Called the supplier  ");

    const [created, note] = await services.activity.listForTask(t.id);
    expect(created).toMatchObject({ source: "system", eventType: "created" });
    expect(note).toMatchObject({
      source: "user",
      eventType: "note",
      body: "Called the supplier",
      editedAt: null,
    });
    await expect(services.activity.addNote(t.id, "   ")).rejects.toBeInstanceOf(ValidationError);
  });

  it("edits notes with an edited timestamp, but never system events", async () => {
    const t = await services.tasks.create({ title: "x" });
    const noteId = await services.activity.addNote(t.id, "First");
    clock.advance(MINUTE);
    await services.activity.editNote(noteId, "First, corrected");

    const [created, note] = await services.activity.listForTask(t.id);
    expect(note).toMatchObject({ body: "First, corrected", editedAt: "2026-11-23T09:01:00.000Z" });
    await expect(services.activity.editNote(created!.id, "hack")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("pages through the global feed newest first with a stable cursor", async () => {
    for (let i = 0; i < 60; i++) {
      clock.advance(MINUTE);
      await services.tasks.create({ title: `Task ${i}` });
    }
    const first = await services.activity.feed();
    expect(first).toHaveLength(50);
    expect(first[0]).toMatchObject({ taskTitle: "Task 59" });

    const last = first.at(-1)!;
    const second = await services.activity.feed({
      before: { occurredAt: last.occurredAt, id: last.id },
    });
    expect(second).toHaveLength(10);
    expect(second.at(-1)).toMatchObject({ taskTitle: "Task 0" });

    const notesOnly = await services.activity.feed({ source: "user" });
    expect(notesOnly).toHaveLength(0);
  });
});

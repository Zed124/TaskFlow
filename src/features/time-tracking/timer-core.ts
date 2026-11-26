import type { Repositories } from "@/db/repositories";
import { sessionElapsedMs, type WorkSession } from "@/db/repositories/work-repository";
import { newId } from "@/lib/ids";
import type { IsoInstant } from "@/lib/time";

export type StopReason = "manual" | "switched" | "task_closed" | "task_deleted";

/**
 * Stops a session inside an existing transaction: closes the open segment, stores the summed
 * duration and records `work_session_logged` on the task. Shared by the timer service and by
 * task status/delete flows so a timer can never keep running on a finished task.
 */
export async function stopSession(
  r: Repositories,
  session: WorkSession,
  now: IsoInstant,
  reason: StopReason,
  groupId: string | null = null,
): Promise<number> {
  await r.work.closeOpenSegment(session.id, now);
  const closed = {
    segments: session.segments.map((s) => ({ ...s, endedAt: s.endedAt ?? now })),
  };
  const durationMs = sessionElapsedMs(closed, new Date(now));
  await r.work.markStopped(session.id, now, durationMs);
  await r.activity.insert({
    id: newId(),
    subject: { kind: "task", id: session.taskId },
    eventType: "work_session_logged",
    payload: { sessionId: session.id, durationMs, reason },
    groupId,
    occurredAt: now,
  });
  return durationMs;
}

/** Stops the active session if it belongs to one of `taskIds`. */
export async function stopActiveForTasks(
  r: Repositories,
  taskIds: readonly string[],
  now: IsoInstant,
  reason: StopReason,
  groupId: string | null = null,
): Promise<void> {
  const active = await r.work.getActive();
  if (active && taskIds.includes(active.taskId)) await stopSession(r, active, now, reason, groupId);
}

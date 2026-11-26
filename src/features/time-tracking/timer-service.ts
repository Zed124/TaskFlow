import type { SqlExecutor } from "@/db/executor";
import { createRepositories } from "@/db/repositories";
import { sessionElapsedMs, type WorkSession } from "@/db/repositories/work-repository";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { nowIso, type Clock } from "@/lib/time";
import { stopSession } from "./timer-core";

export interface ActiveTimer {
  session: WorkSession;
  taskTitle: string;
  /** Elapsed work at read time (open segment counted up to now). */
  elapsedMs: number;
}

export interface TaskTimeSummary {
  sessions: (WorkSession & { elapsedMs: number })[];
  /** Total manually tracked work, including a running/paused session. */
  trackedMs: number;
}

/**
 * Manual work timer: Start → Pause ⇄ Resume → Stop. State lives entirely in the DB
 * (sessions + segments), so a running timer survives closing or restarting the app.
 * Exactly one session can be active at a time (enforced by a unique index).
 */
export function createTimerService(db: SqlExecutor, clock: Clock) {
  const read = createRepositories(db);
  const write = <T>(
    work: (r: ReturnType<typeof createRepositories>, now: ReturnType<typeof nowIso>) => Promise<T>,
  ) => db.transaction((tx) => work(createRepositories(tx), nowIso(clock)));

  return {
    async active(): Promise<ActiveTimer | null> {
      const session = await read.work.getActive();
      if (!session) return null;
      const task = await read.tasks.get(session.taskId, { includeDeleted: true });
      return {
        session,
        taskTitle: task?.title ?? "",
        elapsedMs: sessionElapsedMs(session, clock.now()),
      };
    },

    async forTask(taskId: string): Promise<TaskTimeSummary> {
      const now = clock.now();
      const sessions = (await read.work.listForTask(taskId)).map((s) => ({
        ...s,
        elapsedMs: s.durationMs ?? sessionElapsedMs(s, now),
      }));
      return { sessions, trackedMs: sessions.reduce((sum, s) => sum + s.elapsedMs, 0) };
    },

    /**
     * Starts timing a task. A paused session on the same task resumes; an active session on a
     * different task is stopped first (recorded as "switched").
     */
    async start(taskId: string): Promise<WorkSession> {
      return await write(async (r, now) => {
        const task = await r.tasks.get(taskId);
        if (!task) throw new NotFoundError("Task", taskId);
        if (task.status === "completed" || task.status === "cancelled") {
          throw new ValidationError("Reopen the task before tracking time on it");
        }
        const active = await r.work.getActive();
        if (active?.taskId === taskId) {
          if (active.state === "paused") {
            await r.work.openSegment(newId(), active.id, now);
            await r.work.setState(active.id, "running", now);
          }
          return (await r.work.getActive()) ?? active;
        }
        if (active) await stopSession(r, active, now, "switched");

        const id = newId();
        await r.work.insertSession({ id, taskId, at: now });
        await r.work.openSegment(newId(), id, now);
        const created = await r.work.getActive();
        if (!created) throw new Error("Timer did not start");
        return created;
      });
    },

    async pause(): Promise<void> {
      await write(async (r, now) => {
        const active = await r.work.getActive();
        if (!active || active.state !== "running")
          throw new ValidationError("No running timer to pause");
        await r.work.closeOpenSegment(active.id, now);
        await r.work.setState(active.id, "paused", now);
      });
    },

    async resume(): Promise<void> {
      await write(async (r, now) => {
        const active = await r.work.getActive();
        if (!active || active.state !== "paused")
          throw new ValidationError("No paused timer to resume");
        await r.work.openSegment(newId(), active.id, now);
        await r.work.setState(active.id, "running", now);
      });
    },

    /** Stops the active timer and logs the session. Returns its tracked duration. */
    async stop(): Promise<number> {
      return await write(async (r, now) => {
        const active = await r.work.getActive();
        if (!active) throw new ValidationError("No timer is running");
        return stopSession(r, active, now, "manual");
      });
    },
  };
}

export type TimerService = ReturnType<typeof createTimerService>;

import type { IsoInstant } from "@/lib/time";
import type { SqlExecutor } from "../executor";

export type WorkSessionState = "running" | "paused" | "stopped";

export interface WorkSegment {
  id: string;
  sessionId: string;
  startedAt: IsoInstant;
  endedAt: IsoInstant | null;
}

export interface WorkSession {
  id: string;
  taskId: string;
  state: WorkSessionState;
  startedAt: IsoInstant;
  endedAt: IsoInstant | null;
  /** Set when stopped: the sum of the session's segments. */
  durationMs: number | null;
  note: string;
  segments: WorkSegment[];
}

type SessionRow = {
  id: string;
  task_id: string;
  state: WorkSessionState;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  note: string;
};

type SegmentRow = { id: string; session_id: string; started_at: string; ended_at: string | null };

const SESSION_COLUMNS = "id, task_id, state, started_at, ended_at, duration_ms, note";

/** Manual work sessions and their segments (docs/database.md D4, D5). */
export function createWorkRepository(db: SqlExecutor) {
  async function withSegments(rows: SessionRow[]): Promise<WorkSession[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const segs = await db.select<SegmentRow>(
      `SELECT id, session_id, started_at, ended_at FROM work_segments
       WHERE session_id IN (${ids.map(() => "?").join(", ")}) ORDER BY started_at, rowid`,
      ids,
    );
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      state: r.state,
      startedAt: r.started_at as IsoInstant,
      endedAt: r.ended_at as IsoInstant | null,
      durationMs: r.duration_ms,
      note: r.note,
      segments: segs
        .filter((s) => s.session_id === r.id)
        .map((s) => ({
          id: s.id,
          sessionId: s.session_id,
          startedAt: s.started_at as IsoInstant,
          endedAt: s.ended_at as IsoInstant | null,
        })),
    }));
  }

  return {
    /** The single running or paused session, if any. */
    async getActive(): Promise<WorkSession | null> {
      const rows = await db.select<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM work_sessions WHERE state <> 'stopped' LIMIT 1`,
      );
      return (await withSegments(rows))[0] ?? null;
    },

    async listForTask(taskId: string): Promise<WorkSession[]> {
      const rows = await db.select<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM work_sessions WHERE task_id = ? ORDER BY started_at DESC, rowid DESC`,
        [taskId],
      );
      return withSegments(rows);
    },

    async insertSession(s: { id: string; taskId: string; at: IsoInstant }): Promise<void> {
      await db.execute(
        `INSERT INTO work_sessions (id, task_id, state, started_at, created_at, updated_at)
         VALUES (?, ?, 'running', ?, ?, ?)`,
        [s.id, s.taskId, s.at, s.at, s.at],
      );
    },

    async openSegment(id: string, sessionId: string, at: IsoInstant): Promise<void> {
      await db.execute("INSERT INTO work_segments (id, session_id, started_at) VALUES (?, ?, ?)", [
        id,
        sessionId,
        at,
      ]);
    },

    async closeOpenSegment(sessionId: string, at: IsoInstant): Promise<void> {
      await db.execute(
        "UPDATE work_segments SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL",
        [at, sessionId],
      );
    },

    async setState(sessionId: string, state: "running" | "paused", at: IsoInstant): Promise<void> {
      await db.execute("UPDATE work_sessions SET state = ?, updated_at = ? WHERE id = ?", [
        state,
        at,
        sessionId,
      ]);
    },

    async markStopped(sessionId: string, at: IsoInstant, durationMs: number): Promise<void> {
      await db.execute(
        "UPDATE work_sessions SET state = 'stopped', ended_at = ?, duration_ms = ?, updated_at = ? WHERE id = ?",
        [at, durationMs, at, sessionId],
      );
    },

    /** Closed segments overlapping [from, to) plus open ones, for per-day aggregation. */
    async segmentsBetween(
      from: IsoInstant,
      to: IsoInstant,
    ): Promise<{ taskId: string; startedAt: string; endedAt: string | null }[]> {
      const rows = await db.select<{
        task_id: string;
        started_at: string;
        ended_at: string | null;
      }>(
        `SELECT s.task_id, g.started_at, g.ended_at
         FROM work_segments g JOIN work_sessions s ON s.id = g.session_id
         JOIN tasks t ON t.id = s.task_id
         WHERE t.deleted_at IS NULL AND g.started_at < ? AND (g.ended_at IS NULL OR g.ended_at > ?)`,
        [to, from],
      );
      return rows.map((r) => ({ taskId: r.task_id, startedAt: r.started_at, endedAt: r.ended_at }));
    },
  };
}

export type WorkRepository = ReturnType<typeof createWorkRepository>;

/** Sum of segment lengths; an open segment counts up to `now`. */
export function sessionElapsedMs(session: Pick<WorkSession, "segments">, now: Date): number {
  return session.segments.reduce((sum, s) => {
    const end = s.endedAt ? Date.parse(s.endedAt) : now.getTime();
    return sum + Math.max(0, end - Date.parse(s.startedAt));
  }, 0);
}

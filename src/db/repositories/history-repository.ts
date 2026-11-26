import type { TaskStatus } from "@/domain/task";
import type { IsoInstant, LocalDate } from "@/lib/time";
import type { SqlExecutor } from "../executor";

export interface StatusInterval {
  id: string;
  taskId: string;
  status: TaskStatus;
  startedAt: IsoInstant;
  endedAt: IsoInstant | null;
}

export interface CompletionEvent {
  id: string;
  taskId: string;
  completedAt: IsoInstant;
  completedOn: LocalDate;
  reopenedAt: IsoInstant | null;
}

type IntervalRow = {
  id: string;
  task_id: string;
  status: TaskStatus;
  started_at: string;
  ended_at: string | null;
};

type CompletionRow = {
  id: string;
  task_id: string;
  completed_at: string;
  completed_on: string;
  reopened_at: string | null;
};

/** Status intervals and completion events: append-only history (docs/database.md D2, D3). */
export function createHistoryRepository(db: SqlExecutor) {
  return {
    async openInterval(
      id: string,
      taskId: string,
      status: TaskStatus,
      at: IsoInstant,
    ): Promise<void> {
      await db.execute(
        "INSERT INTO status_intervals (id, task_id, status, started_at) VALUES (?, ?, ?, ?)",
        [id, taskId, status, at],
      );
    },

    async closeOpenInterval(taskId: string, at: IsoInstant): Promise<void> {
      await db.execute(
        "UPDATE status_intervals SET ended_at = ? WHERE task_id = ? AND ended_at IS NULL",
        [at, taskId],
      );
    },

    async listIntervals(taskId: string): Promise<StatusInterval[]> {
      const rows = await db.select<IntervalRow>(
        "SELECT id, task_id, status, started_at, ended_at FROM status_intervals WHERE task_id = ? ORDER BY started_at, rowid",
        [taskId],
      );
      return rows.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        status: r.status,
        startedAt: r.started_at as IsoInstant,
        endedAt: r.ended_at as IsoInstant | null,
      }));
    },

    async insertCompletion(event: CompletionEvent): Promise<void> {
      await db.execute(
        "INSERT INTO completion_events (id, task_id, completed_at, completed_on, reopened_at) VALUES (?, ?, ?, ?, ?)",
        [event.id, event.taskId, event.completedAt, event.completedOn, event.reopenedAt],
      );
    },

    /** Marks the open completion as reopened. The row itself is kept forever. */
    async markReopened(taskId: string, at: IsoInstant): Promise<void> {
      await db.execute(
        "UPDATE completion_events SET reopened_at = ? WHERE task_id = ? AND reopened_at IS NULL",
        [at, taskId],
      );
    },

    async listCompletions(taskId: string): Promise<CompletionEvent[]> {
      const rows = await db.select<CompletionRow>(
        "SELECT id, task_id, completed_at, completed_on, reopened_at FROM completion_events WHERE task_id = ? ORDER BY completed_at, rowid",
        [taskId],
      );
      return rows.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        completedAt: r.completed_at as IsoInstant,
        completedOn: r.completed_on as LocalDate,
        reopenedAt: r.reopened_at as IsoInstant | null,
      }));
    },
  };
}

export type HistoryRepository = ReturnType<typeof createHistoryRepository>;

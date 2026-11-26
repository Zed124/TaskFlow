import type { TaskPriority, TaskStatus } from "@/domain/task";
import type { SqlExecutor } from "../executor";

/** Read-only aggregates for the Analytics page. All queries cover top-level, non-deleted tasks. */
export function createAnalyticsRepository(db: SqlExecutor) {
  return {
    /** Every completion event in the local-date range, with the task's attributes. */
    async completions(fromDate: string, toDate: string) {
      return db.select<{
        task_id: string;
        completed_on: string;
        priority: TaskPriority;
        project_id: string | null;
      }>(
        `SELECT c.task_id, c.completed_on, t.priority, t.project_id
         FROM completion_events c JOIN tasks t ON t.id = c.task_id
         WHERE t.deleted_at IS NULL AND t.parent_id IS NULL AND c.completed_on BETWEEN ? AND ?`,
        [fromDate, toDate],
      );
    },

    async created(fromInstant: string, toInstant: string) {
      return db.select<{ created_at: string }>(
        `SELECT created_at FROM tasks
         WHERE deleted_at IS NULL AND parent_id IS NULL AND created_at >= ? AND created_at < ?`,
        [fromInstant, toInstant],
      );
    },

    /** Tasks whose *first* completion falls in the range (for lead time: created → first done). */
    async firstCompletions(fromInstant: string, toInstant: string) {
      return db.select<{
        task_id: string;
        created_at: string;
        first_done: string;
        project_id: string | null;
      }>(
        `SELECT t.id AS task_id, t.created_at, f.first_done, t.project_id
         FROM tasks t
         JOIN (SELECT task_id, min(completed_at) AS first_done FROM completion_events GROUP BY task_id) f
           ON f.task_id = t.id
         WHERE t.deleted_at IS NULL AND t.parent_id IS NULL AND f.first_done >= ? AND f.first_done < ?`,
        [fromInstant, toInstant],
      );
    },

    /** In-progress intervals of tasks completed within the range (any completion). */
    async inProgressIntervalsOfCompleted(fromDate: string, toDate: string) {
      return db.select<{ task_id: string; started_at: string; ended_at: string | null }>(
        `SELECT i.task_id, i.started_at, i.ended_at FROM status_intervals i
         WHERE i.status = 'in_progress' AND i.task_id IN (
           SELECT c.task_id FROM completion_events c JOIN tasks t ON t.id = c.task_id
           WHERE t.deleted_at IS NULL AND t.parent_id IS NULL AND c.completed_on BETWEEN ? AND ?)`,
        [fromDate, toDate],
      );
    },

    async openByPriority() {
      return db.select<{ priority: TaskPriority; status: TaskStatus; n: number }>(
        `SELECT priority, status, count(*) AS n FROM tasks
         WHERE deleted_at IS NULL AND archived_at IS NULL AND parent_id IS NULL
           AND status IN ('todo', 'in_progress')
         GROUP BY priority, status`,
      );
    },

    async openByProject() {
      return db.select<{ project_id: string | null; n: number }>(
        `SELECT project_id, count(*) AS n FROM tasks
         WHERE deleted_at IS NULL AND archived_at IS NULL AND parent_id IS NULL
           AND status IN ('todo', 'in_progress')
         GROUP BY project_id`,
      );
    },

    /** Work segments overlapping [from, to), with the owning task's project. */
    async segments(fromInstant: string, toInstant: string) {
      return db.select<{ started_at: string; ended_at: string | null; project_id: string | null }>(
        `SELECT g.started_at, g.ended_at, t.project_id
         FROM work_segments g
         JOIN work_sessions s ON s.id = g.session_id
         JOIN tasks t ON t.id = s.task_id
         WHERE t.deleted_at IS NULL AND g.started_at < ? AND (g.ended_at IS NULL OR g.ended_at > ?)`,
        [toInstant, fromInstant],
      );
    },
  };
}

export type AnalyticsRepository = ReturnType<typeof createAnalyticsRepository>;

import type { SqlExecutor } from "../executor";

export interface OpenTaskCounts {
  open: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
}

/**
 * Aggregate queries for the dashboard (and later analytics). Counts cover top-level,
 * non-deleted, non-archived tasks.
 */
export function createStatsRepository(db: SqlExecutor) {
  return {
    async openCounts(today: string): Promise<OpenTaskCounts> {
      const rows = await db.select<{
        open: number;
        in_progress: number;
        overdue: number;
        due_today: number;
      }>(
        `SELECT
           count(*) AS open,
           coalesce(sum(status = 'in_progress'), 0) AS in_progress,
           coalesce(sum(due_date < ?), 0) AS overdue,
           coalesce(sum(due_date = ?), 0) AS due_today
         FROM tasks
         WHERE deleted_at IS NULL AND archived_at IS NULL AND parent_id IS NULL
           AND status IN ('todo', 'in_progress')`,
        [today, today],
      );
      const r = rows[0];
      return {
        open: r?.open ?? 0,
        inProgress: r?.in_progress ?? 0,
        overdue: r?.overdue ?? 0,
        dueToday: r?.due_today ?? 0,
      };
    },

    /**
     * Distinct top-level tasks completed per local day in [from, to] (subtasks are progress
     * within a task, not separate tasks, matching every other count on the dashboard). A task completed, reopened and
     * completed again on the same day counts once; on different days it counts on each.
     */
    async completionsByDay(from: string, to: string): Promise<Map<string, number>> {
      const rows = await db.select<{ day: string; n: number }>(
        `SELECT c.completed_on AS day, count(DISTINCT c.task_id) AS n
         FROM completion_events c JOIN tasks t ON t.id = c.task_id
         WHERE t.deleted_at IS NULL AND t.parent_id IS NULL
           AND c.completed_on >= ? AND c.completed_on <= ?
         GROUP BY c.completed_on`,
        [from, to],
      );
      return new Map(rows.map((r) => [r.day, r.n]));
    },
  };
}

export type StatsRepository = ReturnType<typeof createStatsRepository>;

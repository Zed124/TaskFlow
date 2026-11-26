import { addDays } from "date-fns";
import type { SqlExecutor } from "@/db/executor";
import {
  planNotifications,
  type NotifiableTask,
  type NotificationPrefs,
  type PlannedNotification,
} from "@/domain/notifications";
import { newId } from "@/lib/ids";
import { nowIso, toLocalDate, type Clock, type LocalDate } from "@/lib/time";

/**
 * Finds notifications that are due now and records them in `notification_log` in the same
 * transaction, so each is delivered at most once — across restarts and even if two windows
 * raced. The caller shows what is returned.
 */
export function createNotificationService(db: SqlExecutor, clock: Clock) {
  return {
    async collectDue(prefs: NotificationPrefs): Promise<PlannedNotification[]> {
      if (!prefs.enabled) return [];
      return await db.transaction(async (tx) => {
        const now = clock.now();
        const tomorrow = toLocalDate(addDays(now, 1));
        const rows = await tx.select<{
          id: string;
          title: string;
          due_date: string;
          due_time: string | null;
        }>(
          `SELECT id, title, due_date, due_time FROM tasks
           WHERE deleted_at IS NULL AND archived_at IS NULL
             AND status IN ('todo', 'in_progress')
             AND due_date IS NOT NULL AND due_date <= ?`,
          [tomorrow],
        );
        const tasks: NotifiableTask[] = rows.map((r) => ({
          id: r.id,
          title: r.title,
          dueDate: r.due_date as LocalDate,
          dueTime: r.due_time,
        }));
        const sentRows = await tx.select<{ dedupe_key: string }>(
          "SELECT dedupe_key FROM notification_log WHERE sent_at >= ?",
          [addDays(now, -3).toISOString()],
        );
        const planned = planNotifications({
          now,
          prefs,
          tasks,
          sent: new Set(sentRows.map((r) => r.dedupe_key)),
        });

        const at = nowIso(clock);
        for (const n of planned) {
          for (const key of n.dedupeKeys) {
            await tx.execute(
              `INSERT INTO notification_log (id, task_id, kind, dedupe_key, sent_at) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(dedupe_key) DO NOTHING`,
              [newId(), n.taskId, n.kind, key, at],
            );
          }
        }
        return planned;
      });
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;

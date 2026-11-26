import { addDays, format } from "date-fns";
import { toLocalDate, type LocalDate } from "@/lib/time";

export interface NotifiableTask {
  id: string;
  title: string;
  dueDate: LocalDate;
  dueTime: string | null;
}

export interface NotificationPrefs {
  enabled: boolean;
  reminders: boolean;
  reminderLeadMinutes: number;
  dailyDigest: boolean;
  digestTime: string; // "HH:mm"
  overdue: boolean;
}

export type NotificationKind = "reminder" | "overdue" | "overdue_batch" | "digest";

export interface PlannedNotification {
  kind: NotificationKind;
  /** Unique per occurrence; recorded so the same notification is never shown twice. */
  dedupeKeys: string[];
  title: string;
  body: string;
  taskId: string | null;
}

export interface PlanInput {
  now: Date;
  prefs: NotificationPrefs;
  /** Open tasks with a due date (top-level and subtasks). */
  tasks: readonly NotifiableTask[];
  /** dedupe keys already sent. */
  sent: ReadonlySet<string>;
}

/** A reminder that is more than this late (app was closed) is dropped as stale. */
export const REMINDER_GRACE_MS = 30 * 60_000;
/** Only tasks that became overdue within this window get an individual alert. */
export const OVERDUE_WINDOW_MS = 24 * 60 * 60_000;
/** More new overdue tasks than this at once collapse into one summary. */
export const OVERDUE_BATCH_THRESHOLD = 3;

function atLocal(date: LocalDate, time: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm);
}

/** The moment a task becomes overdue: its due time, or the end of its due day. */
export function overdueAt(task: NotifiableTask): Date {
  if (task.dueTime) return atLocal(task.dueDate, task.dueTime);
  return atLocal(toLocalDate(addDays(atLocal(task.dueDate, "00:00"), 1)), "00:00");
}

const dueKey = (t: NotifiableTask) => `${t.dueDate}T${t.dueTime ?? ""}`;

/**
 * Decides which notifications to show right now. Pure and deterministic: the scheduler calls it
 * every minute, records the returned dedupe keys and shows the notifications.
 *
 * Rules (chosen to stay helpful without nagging):
 * - Reminder: for tasks with a due time, at (due − lead). Skipped if the app was closed past the
 *   grace window — no stale reminders on startup.
 * - Overdue: once per task and due date, only if it became overdue in the last 24 h; several at
 *   once become a single summary. Older overdue work is covered by the daily digest.
 * - Digest: once per day at or after the configured time, only when something is due/overdue.
 */
export function planNotifications({ now, prefs, tasks, sent }: PlanInput): PlannedNotification[] {
  if (!prefs.enabled) return [];
  const out: PlannedNotification[] = [];
  const nowMs = now.getTime();
  const today = toLocalDate(now);

  if (prefs.reminders) {
    for (const task of tasks) {
      if (!task.dueTime) continue;
      const due = atLocal(task.dueDate, task.dueTime);
      const fireAt = due.getTime() - prefs.reminderLeadMinutes * 60_000;
      const key = `reminder:${task.id}:${dueKey(task)}:${prefs.reminderLeadMinutes}`;
      if (nowMs >= fireAt && nowMs < fireAt + REMINDER_GRACE_MS && !sent.has(key)) {
        out.push({
          kind: "reminder",
          dedupeKeys: [key],
          title: task.title,
          body:
            prefs.reminderLeadMinutes === 0
              ? `Due now (${task.dueTime})`
              : `Due at ${task.dueTime}`,
          taskId: task.id,
        });
      }
    }
  }

  if (prefs.overdue) {
    const fresh = tasks.filter((task) => {
      const at = overdueAt(task).getTime();
      return (
        nowMs >= at &&
        nowMs - at < OVERDUE_WINDOW_MS &&
        !sent.has(`overdue:${task.id}:${dueKey(task)}`)
      );
    });
    if (fresh.length > OVERDUE_BATCH_THRESHOLD) {
      out.push({
        kind: "overdue_batch",
        dedupeKeys: fresh.map((t) => `overdue:${t.id}:${dueKey(t)}`),
        title: `${fresh.length} tasks are now overdue`,
        body: listTitles(fresh),
        taskId: null,
      });
    } else {
      for (const task of fresh) {
        out.push({
          kind: "overdue",
          dedupeKeys: [`overdue:${task.id}:${dueKey(task)}`],
          title: `Overdue: ${task.title}`,
          body: task.dueTime
            ? `Was due ${format(atLocal(task.dueDate, task.dueTime), "EEE HH:mm")}`
            : "Was due yesterday",
          taskId: task.id,
        });
      }
    }
  }

  if (prefs.dailyDigest) {
    const key = `digest:${today}`;
    if (!sent.has(key) && now >= atLocal(today, prefs.digestTime)) {
      const dueToday = tasks.filter((t) => t.dueDate === today);
      const overdue = tasks.filter((t) => t.dueDate < today);
      if (dueToday.length + overdue.length > 0) {
        const parts = [
          dueToday.length ? `${dueToday.length} due today` : null,
          overdue.length ? `${overdue.length} overdue` : null,
        ].filter(Boolean);
        out.push({
          kind: "digest",
          dedupeKeys: [key],
          title: `Today: ${parts.join(", ")}`,
          body: listTitles([...overdue, ...dueToday]),
          taskId: null,
        });
      }
    }
  }

  return out;
}

function listTitles(tasks: readonly NotifiableTask[], max = 3): string {
  const shown = tasks.slice(0, max).map((t) => `• ${t.title}`);
  if (tasks.length > max) shown.push(`+${tasks.length - max} more`);
  return shown.join("\n");
}

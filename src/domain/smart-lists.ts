import { addDays, startOfDay } from "date-fns";
import { toIsoInstant, toLocalDate } from "@/lib/time";
import type { TaskStatus } from "./task";
import type { TaskFilter } from "./task-filter";

const OPEN: readonly TaskStatus[] = ["todo", "in_progress"];

/**
 * The built-in views, expressed as ordinary TaskFilters so every view shares one query path.
 * `now` is passed in (never read from a global clock) to keep them testable.
 */
export function smartFilters(now: Date) {
  const today = toLocalDate(now);
  const yesterday = toLocalDate(addDays(now, -1));
  const tomorrow = toLocalDate(addDays(now, 1));
  const todayStart = toIsoInstant(startOfDay(now));
  const tomorrowStart = toIsoInstant(startOfDay(addDays(now, 1)));

  return {
    overdue: {
      statuses: OPEN,
      due: { to: yesterday },
      sort: { field: "due", direction: "asc" },
    },
    dueToday: {
      statuses: OPEN,
      due: { from: today, to: today },
      sort: { field: "priority", direction: "desc" },
    },
    completedToday: {
      statuses: ["completed"],
      completed: { from: todayStart, to: tomorrowStart },
      sort: { field: "completed", direction: "desc" },
    },
    upcoming: {
      statuses: OPEN,
      due: { from: tomorrow },
      sort: { field: "due", direction: "asc" },
    },
    inProgress: {
      statuses: ["in_progress"],
      sort: { field: "updated", direction: "desc" },
    },
    completed: {
      statuses: ["completed"],
      sort: { field: "completed", direction: "desc" },
    },
  } satisfies Record<string, TaskFilter>;
}

export type SmartListId = keyof ReturnType<typeof smartFilters>;

import type { TaskStatus } from "./task";

export interface IntervalLike {
  status: TaskStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface StatusDurationSummary {
  /** Total time spent in In Progress across all intervals (status duration, not tracked work). */
  inProgressMs: number;
  /** True when the task is in progress right now, so the total is still growing. */
  inProgressOngoing: boolean;
  /** Number of separate In Progress stretches. */
  inProgressStretches: number;
}

/**
 * Sums status intervals. An open interval is measured up to `now` and flagged as ongoing,
 * so the UI never presents a still-growing number as final.
 */
export function summarizeStatusDurations(
  intervals: readonly IntervalLike[],
  now: Date,
): StatusDurationSummary {
  let inProgressMs = 0;
  let inProgressOngoing = false;
  let inProgressStretches = 0;
  for (const interval of intervals) {
    if (interval.status !== "in_progress") continue;
    const start = Date.parse(interval.startedAt);
    const end = interval.endedAt ? Date.parse(interval.endedAt) : now.getTime();
    inProgressMs += Math.max(0, end - start);
    inProgressStretches += 1;
    if (!interval.endedAt) inProgressOngoing = true;
  }
  return { inProgressMs, inProgressOngoing, inProgressStretches };
}

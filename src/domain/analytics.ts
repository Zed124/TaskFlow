import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toLocalDate, type LocalDate } from "@/lib/time";
import type { WeekStart } from "./settings";

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const RANGE_PRESETS = ["7d", "30d", "90d", "12m"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

/** Inclusive local-date range ending today. */
export function presetRange(preset: RangePreset, now: Date): DateRange {
  const to = toLocalDate(now);
  const from =
    preset === "12m"
      ? toLocalDate(startOfMonth(addMonths(now, -11)))
      : toLocalDate(addDays(now, -(Number(preset.slice(0, -1)) - 1)));
  return { from, to };
}

export function defaultGranularity(preset: RangePreset): Granularity {
  return preset === "12m" ? "month" : preset === "90d" ? "week" : "day";
}

const local = (d: LocalDate) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, day);
};

/** Start date (local) of the bucket containing `date`. */
export function bucketStart(
  date: LocalDate,
  granularity: Granularity,
  weekStartsOn: WeekStart,
): LocalDate {
  const d = local(date);
  if (granularity === "day") return date;
  if (granularity === "week") return toLocalDate(startOfWeek(d, { weekStartsOn }));
  return toLocalDate(startOfMonth(d));
}

/** Every bucket start overlapping the range, in order (so empty periods still appear). */
export function bucketsInRange(
  range: DateRange,
  granularity: Granularity,
  weekStartsOn: WeekStart,
): LocalDate[] {
  const end = local(range.to);
  const keys: LocalDate[] = [];
  let cursor = local(bucketStart(range.from, granularity, weekStartsOn));
  while (cursor <= end) {
    keys.push(toLocalDate(cursor));
    cursor =
      granularity === "day"
        ? addDays(cursor, 1)
        : granularity === "week"
          ? addWeeks(cursor, 1)
          : addMonths(cursor, 1);
  }
  return keys;
}

export function bucketLabel(key: LocalDate, granularity: Granularity, now: Date): string {
  const d = local(key);
  if (granularity === "month") return format(d, isSameYear(d, now) ? "MMM" : "MMM yyyy");
  return format(d, isSameYear(d, now) ? "MMM d" : "MMM d, yyyy");
}

/**
 * Splits [start, end) into per-local-day milliseconds, so a work session crossing midnight is
 * attributed to both days.
 */
export function splitByLocalDay(start: Date, end: Date): Map<LocalDate, number> {
  const out = new Map<LocalDate, number>();
  let cursor = start;
  while (cursor < end) {
    const nextMidnight = startOfDay(addDays(cursor, 1));
    const sliceEnd = nextMidnight < end ? nextMidnight : end;
    const key = toLocalDate(cursor);
    out.set(key, (out.get(key) ?? 0) + (sliceEnd.getTime() - cursor.getTime()));
    cursor = sliceEnd;
  }
  return out;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

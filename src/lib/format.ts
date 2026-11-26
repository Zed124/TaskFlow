import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameYear,
  parseISO,
} from "date-fns";
import type { LocalDate } from "./time";

/** Parses a local calendar date ("YYYY-MM-DD") as local midnight — never as UTC. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export type DueTone = "overdue" | "today" | "soon" | "later" | "none";

export interface DueLabel {
  text: string;
  tone: DueTone;
}

/**
 * Human label for a due date relative to today. Relative words are passed in so the
 * function stays free of i18n plumbing (and testable).
 */
export function describeDue(
  dueDate: LocalDate | string | null,
  dueTime: string | null,
  today: Date,
  words: { today: string; tomorrow: string; yesterday: string; none: string },
): DueLabel {
  if (!dueDate) return { text: words.none, tone: "none" };
  const date = parseLocalDate(dueDate);
  const diff = differenceInCalendarDays(date, today);
  let text: string;
  if (diff === 0) text = words.today;
  else if (diff === 1) text = words.tomorrow;
  else if (diff === -1) text = words.yesterday;
  else if (diff > 1 && diff < 7) text = format(date, "EEEE");
  else text = format(date, isSameYear(date, today) ? "EEE, MMM d" : "MMM d, yyyy");
  if (dueTime) text += ` ${dueTime}`;
  const tone: DueTone = diff < 0 ? "overdue" : diff === 0 ? "today" : diff <= 3 ? "soon" : "later";
  return { text, tone };
}

/** "Mon, Nov 23, 14:05" (year added when not this year). */
export function formatInstant(iso: string, now: Date = new Date()): string {
  const date = parseISO(iso);
  return format(date, isSameYear(date, now) ? "EEE, MMM d, HH:mm" : "EEE, MMM d yyyy, HH:mm");
}

export function formatDayHeading(iso: string, now: Date = new Date()): string {
  const date = parseISO(iso);
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return format(date, isSameYear(date, now) ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy");
}

export function formatRelative(iso: string): string {
  const date = parseISO(iso);
  if (Date.now() - date.getTime() < 45_000) return "just now";
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** Compact duration: "45s", "12m", "3h 05m", "2d 4h". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatLocalDate(value: string, now: Date = new Date()): string {
  const date = parseLocalDate(value);
  return format(date, isSameYear(date, now) ? "MMM d" : "MMM d, yyyy");
}

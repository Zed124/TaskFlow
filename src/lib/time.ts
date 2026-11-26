/**
 * Time conventions (see docs/architecture.md §5):
 * - Instants are UTC ISO-8601 strings with milliseconds, e.g. "2026-11-26T14:03:22.118Z".
 * - Calendar dates are local "YYYY-MM-DD" strings and are never converted to instants.
 *
 * All production code obtains "now" through a Clock so tests can control time.
 */

export type IsoInstant = string & { readonly __brand: "IsoInstant" };
export type LocalDate = string & { readonly __brand: "LocalDate" };

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoInstant(date: Date): IsoInstant {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return date.toISOString() as IsoInstant;
}

export function nowIso(clock: Clock = systemClock): IsoInstant {
  return toIsoInstant(clock.now());
}

export function isIsoInstant(value: string): value is IsoInstant {
  return ISO_INSTANT_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** The local calendar date of an instant, in the machine's current time zone. */
export function toLocalDate(date: Date): LocalDate {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}` as LocalDate;
}

export function todayLocal(clock: Clock = systemClock): LocalDate {
  return toLocalDate(clock.now());
}

/** Validates a real calendar date (rejects 2026-02-30). */
export function isLocalDate(value: string): value is LocalDate {
  const match = LOCAL_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

/** A test clock whose time only moves when told to. */
export function createFixedClock(start: Date | string): Clock & {
  set(date: Date | string): void;
  advance(ms: number): void;
} {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set: (date) => {
      current = new Date(date);
    },
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

import { addDays, addWeeks } from "date-fns";
import { isLocalDate, toLocalDate, type LocalDate } from "@/lib/time";
import type { TaskPriority } from "./task";

/**
 * Quick Add syntax (all optional, anywhere in the text, case-insensitive):
 *   dates      today · tomorrow · mon…sun · 2026-12-01 · +3d · +2w
 *   time       14:30 · 9am · 5:15pm          (implies today when no date is given)
 *   priority   !low !medium !high !urgent    (also !l !m !h !u, !1–!4)
 *   project    @Name      (spaces, dashes and underscores are ignored when matching)
 *   category   #Name
 * Every recognized token is reported, so the UI can show it and let the user un-parse it.
 */

export type QuickTokenKind = "due" | "time" | "priority" | "project" | "category";

export interface QuickToken {
  /** Index of the whitespace-separated word in the input. */
  index: number;
  kind: QuickTokenKind;
  raw: string;
  /** Display value (e.g. the matched project's real name). */
  label: string;
}

export interface QuickAddResult {
  title: string;
  dueDate: LocalDate | null;
  dueTime: string | null;
  priority: TaskPriority | null;
  projectId: string | null;
  categoryId: string | null;
  tokens: QuickToken[];
  /** Tokens that looked like references but matched nothing (left in the title). */
  unmatched: { index: number; raw: string; kind: "project" | "category" }[];
}

export interface QuickAddContext {
  today: Date;
  projects: readonly { id: string; name: string }[];
  categories: readonly { id: string; name: string }[];
}

const PRIORITIES: Record<string, TaskPriority> = {
  low: "low",
  l: "low",
  "1": "low",
  medium: "medium",
  med: "medium",
  m: "medium",
  "2": "medium",
  high: "high",
  h: "high",
  "3": "high",
  urgent: "urgent",
  u: "urgent",
  "4": "urgent",
};

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

function parseDate(word: string, today: Date): LocalDate | null {
  const w = word.toLowerCase();
  if (w === "today" || w === "tod") return toLocalDate(today);
  if (w === "tomorrow" || w === "tmr" || w === "tom") return toLocalDate(addDays(today, 1));
  const weekday = WEEKDAYS[w];
  if (weekday !== undefined) {
    // Next occurrence strictly after today ("mon" on a Monday means next Monday).
    const ahead = (weekday - today.getDay() + 7) % 7 || 7;
    return toLocalDate(addDays(today, ahead));
  }
  const rel = /^\+(\d{1,3})([dw])$/.exec(w);
  if (rel) {
    const n = Number(rel[1]);
    return toLocalDate(rel[2] === "d" ? addDays(today, n) : addWeeks(today, n));
  }
  if (isLocalDate(word)) return word;
  return null;
}

function parseTime(word: string): string | null {
  const w = word.toLowerCase();
  const h24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(w);
  if (h24) return `${(h24[1] ?? "").padStart(2, "0")}:${h24[2]}`;
  const h12 = /^(1[0-2]|0?[1-9])(?::([0-5]\d))?(am|pm)$/.exec(w);
  if (h12) {
    let hour = Number(h12[1]) % 12;
    if (h12[3] === "pm") hour += 12;
    return `${String(hour).padStart(2, "0")}:${h12[2] ?? "00"}`;
  }
  return null;
}

/**
 * Parses Quick Add text. Words whose index is in `ignore` are kept as plain title text
 * (the user clicked "×" on a recognized token).
 */
export function parseQuickAdd(
  input: string,
  ctx: QuickAddContext,
  ignore: ReadonlySet<number> = new Set(),
): QuickAddResult {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const result: QuickAddResult = {
    title: "",
    dueDate: null,
    dueTime: null,
    priority: null,
    projectId: null,
    categoryId: null,
    tokens: [],
    unmatched: [],
  };
  const titleWords: string[] = [];

  words.forEach((word, index) => {
    if (ignore.has(index)) {
      titleWords.push(word);
      return;
    }

    if (word.startsWith("!") && result.priority === null) {
      const p = PRIORITIES[word.slice(1).toLowerCase()];
      if (p) {
        result.priority = p;
        result.tokens.push({ index, kind: "priority", raw: word, label: p });
        return;
      }
    }

    if ((word.startsWith("@") || word.startsWith("#")) && word.length > 1) {
      const isProject = word.startsWith("@");
      const kind = isProject ? "project" : "category";
      const already = isProject ? result.projectId : result.categoryId;
      if (already === null) {
        const list = isProject ? ctx.projects : ctx.categories;
        const key = normalize(word.slice(1));
        const match =
          list.find((e) => normalize(e.name) === key) ??
          list.find((e) => normalize(e.name).startsWith(key));
        if (match) {
          if (isProject) result.projectId = match.id;
          else result.categoryId = match.id;
          result.tokens.push({ index, kind, raw: word, label: match.name });
          return;
        }
        result.unmatched.push({ index, raw: word, kind });
      }
    }

    if (result.dueDate === null) {
      const date = parseDate(word, ctx.today);
      if (date) {
        result.dueDate = date;
        result.tokens.push({ index, kind: "due", raw: word, label: date });
        return;
      }
    }

    if (result.dueTime === null) {
      const time = parseTime(word);
      if (time) {
        result.dueTime = time;
        result.tokens.push({ index, kind: "time", raw: word, label: time });
        return;
      }
    }

    titleWords.push(word);
  });

  if (result.dueTime !== null && result.dueDate === null) result.dueDate = toLocalDate(ctx.today);
  result.title = titleWords.join(" ");
  return result;
}

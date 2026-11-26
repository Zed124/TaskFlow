import { describe, expect, it } from "vitest";
import { describeDue, formatDuration, parseLocalDate } from "./format";

const words = { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday", none: "No date" };
const today = new Date(2026, 10, 26, 15, 30); // Thu, Nov 26 2026, local afternoon

describe("describeDue", () => {
  it("labels nearby days relatively and assigns tones", () => {
    expect(describeDue("2026-11-26", null, today, words)).toEqual({ text: "Today", tone: "today" });
    expect(describeDue("2026-11-27", "09:00", today, words)).toEqual({
      text: "Tomorrow 09:00",
      tone: "soon",
    });
    expect(describeDue("2026-11-25", null, today, words)).toEqual({
      text: "Yesterday",
      tone: "overdue",
    });
    expect(describeDue("2026-11-30", null, today, words)).toEqual({
      text: "Monday",
      tone: "later",
    });
    expect(describeDue("2026-12-15", null, today, words).text).toBe("Tue, Dec 15");
    expect(describeDue("2027-01-04", null, today, words).text).toBe("Jan 4, 2027");
    expect(describeDue(null, null, today, words)).toEqual({ text: "No date", tone: "none" });
  });

  it("treats due dates as local calendar days, not UTC instants", () => {
    const d = parseLocalDate("2026-03-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 1, 0]);
  });
});

describe("formatDuration", () => {
  it("formats compactly", () => {
    expect(formatDuration(42_000)).toBe("42s");
    expect(formatDuration(12 * 60_000)).toBe("12m");
    expect(formatDuration(3 * 3_600_000 + 5 * 60_000)).toBe("3h 05m");
    expect(formatDuration(52 * 3_600_000)).toBe("2d 4h");
    expect(formatDuration(-5)).toBe("0s");
  });
});

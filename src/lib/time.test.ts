import { describe, expect, it } from "vitest";
import { createFixedClock, isIsoInstant, isLocalDate, nowIso, toLocalDate } from "./time";

describe("time helpers", () => {
  it("produces fixed-format UTC instants", () => {
    const clock = createFixedClock("2026-11-26T14:03:22.118Z");
    expect(nowIso(clock)).toBe("2026-11-26T14:03:22.118Z");
    clock.advance(1000);
    expect(nowIso(clock)).toBe("2026-11-26T14:03:23.118Z");
    expect(isIsoInstant(nowIso(clock))).toBe(true);
    expect(isIsoInstant("2026-11-26T14:03:22Z")).toBe(false);
  });

  it("formats local calendar dates from local components", () => {
    expect(toLocalDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("validates real calendar dates", () => {
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
  });
});

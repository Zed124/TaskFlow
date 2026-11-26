import { createServices } from "@/app/services";
import { createFixedClock } from "@/lib/time";
import { createTestDb } from "./test-db";

/** The full service graph on a fresh in-memory DB, with a controllable clock. */
export async function createTestServices(start = "2026-11-23T09:00:00.000Z") {
  const db = await createTestDb();
  const clock = createFixedClock(start);
  return { db, clock, services: createServices(db, clock) };
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

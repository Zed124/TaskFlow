import type { SqlExecutor } from "@/db/executor";
import { createSettingsService } from "@/features/settings/settings-service";
import { systemClock, type Clock } from "@/lib/time";

/**
 * Composition root (like DI registration in Program.cs). Every feature service is created here
 * from the same executor and clock, so tests can build the same graph on an in-memory DB.
 */
export function createServices(db: SqlExecutor, clock: Clock = systemClock) {
  return {
    settings: createSettingsService(db, clock),
  };
}

export type Services = ReturnType<typeof createServices>;

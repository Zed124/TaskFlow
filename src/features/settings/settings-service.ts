import type { SqlExecutor } from "@/db/executor";
import { createSettingsRepository } from "@/db/repositories/settings-repository";
import type { SettingKey, Settings, SettingValue } from "@/domain/settings";
import type { Clock } from "@/lib/time";

/**
 * Settings use cases. Currently a pass-through; native side effects (e.g. telling Rust about
 * close-to-tray, toggling autostart) will be added here in Phase 6.
 */
export function createSettingsService(db: SqlExecutor, clock: Clock) {
  const repo = createSettingsRepository(db, clock);
  return {
    getAll: (): Promise<Settings> => repo.getAll(),
    set: <K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> =>
      repo.set(key, value),
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;

import {
  defaultSettings,
  isSettingKey,
  settingDefinitions,
  type SettingKey,
  type Settings,
  type SettingValue,
} from "@/domain/settings";
import { ValidationError } from "@/lib/errors";
import { nowIso, systemClock, type Clock } from "@/lib/time";
import type { SqlExecutor } from "../executor";

interface SettingRow {
  [column: string]: unknown;
  key: string;
  value: string;
}

/** Parses a stored value; invalid or unknown data falls back to the default rather than crashing the app. */
function parseStored<K extends SettingKey>(key: K, raw: string): SettingValue<K> {
  const definition = settingDefinitions[key];
  try {
    const result = definition.schema.safeParse(JSON.parse(raw));
    if (result.success) return result.data as SettingValue<K>;
  } catch {
    // fall through to default
  }
  console.warn(`[settings] Ignoring invalid stored value for "${key}"`);
  return definition.default as SettingValue<K>;
}

export function createSettingsRepository(db: SqlExecutor, clock: Clock = systemClock) {
  return {
    async getAll(): Promise<Settings> {
      const settings = defaultSettings();
      const rows = await db.select<SettingRow>("SELECT key, value FROM settings");
      for (const row of rows) {
        if (isSettingKey(row.key)) {
          (settings as Record<SettingKey, unknown>)[row.key] = parseStored(row.key, row.value);
        }
      }
      return settings;
    },

    async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
      const rows = await db.select<SettingRow>("SELECT key, value FROM settings WHERE key = ?", [
        key,
      ]);
      const row = rows[0];
      return row
        ? parseStored(key, row.value)
        : (settingDefinitions[key].default as SettingValue<K>);
    },

    async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
      const result = settingDefinitions[key].schema.safeParse(value);
      if (!result.success) {
        throw new ValidationError(
          `Invalid value for setting "${key}"`,
          result.error.issues.map((i) => i.message),
        );
      }
      await db.execute(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(result.data), nowIso(clock)],
      );
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

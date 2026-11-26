import { z } from "zod";
import { DEFAULT_DASHBOARD_LAYOUT, dashboardLayoutSchema } from "./dashboard";

export const ACCENTS = ["violet", "indigo", "blue", "teal", "emerald", "amber", "rose"] as const;
export type Accent = (typeof ACCENTS)[number];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

function define<S extends z.ZodType>(schema: S, defaultValue: z.infer<S>) {
  return { schema, default: defaultValue };
}

/**
 * Every persisted setting, with its validation schema and default.
 * Adding a setting needs no migration — just add it here.
 */
export const settingDefinitions = {
  "ui.sidebarCollapsed": define(z.boolean(), false),
  "ui.accent": define(z.enum(ACCENTS), "violet"),
  "ui.density": define(z.enum(DENSITIES), "comfortable"),
  "onboarding.completed": define(z.boolean(), false),
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. Used by the calendar, week groupings and analytics. */
  "ui.weekStartsOn": define(z.union([z.literal(0), z.literal(1), z.literal(6)]), 1),
  /** Close button hides to the tray instead of quitting. */
  "system.closeToTray": define(z.boolean(), true),
  /** Master switch for Windows notifications. */
  "notifications.enabled": define(z.boolean(), true),
  /** Remind before tasks that have a due time. */
  "notifications.reminders": define(z.boolean(), true),
  "notifications.reminderLeadMinutes": define(
    z.union([
      z.literal(0),
      z.literal(5),
      z.literal(10),
      z.literal(15),
      z.literal(30),
      z.literal(60),
    ]),
    15,
  ),
  /** One summary per day of what is due and overdue. */
  "notifications.dailyDigest": define(z.boolean(), true),
  "notifications.digestTime": define(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), "09:00"),
  /** Alert when a task becomes overdue (once per task and due date). */
  "notifications.overdue": define(z.boolean(), true),
  /** Automatic JSON backups to the backup folder. */
  "backup.auto": define(z.boolean(), true),
  "backup.intervalHours": define(
    z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(168)]),
    24,
  ),
  /** null = Documents\TaskFlow Backups. Device-specific. */
  "backup.directory": define(z.string().min(1).nullable(), null),
  /** How many automatic backups to keep. */
  "backup.retention": define(z.number().int().min(1).max(365), 14),
  /** Order and visibility of dashboard widgets. */
  "dashboard.layout": define(dashboardLayoutSchema, DEFAULT_DASHBOARD_LAYOUT),
};

export const REMINDER_LEADS = [0, 5, 10, 15, 30, 60] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

export const BACKUP_INTERVALS = [6, 12, 24, 168] as const;
export type BackupInterval = (typeof BACKUP_INTERVALS)[number];

export const WEEK_STARTS = [1, 0, 6] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

export type SettingKey = keyof typeof settingDefinitions;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingDefinitions)[K]["schema"]>;
export type Settings = { [K in SettingKey]: SettingValue<K> };

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(settingDefinitions, key);
}

export function defaultSettings(): Settings {
  const entries = Object.entries(settingDefinitions).map(([k, d]) => [k, d.default] as const);
  return Object.fromEntries(entries) as Settings;
}

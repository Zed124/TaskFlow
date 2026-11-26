import { z } from "zod";

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
};

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

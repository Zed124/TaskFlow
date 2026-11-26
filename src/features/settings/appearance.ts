import { useEffect, useState } from "react";
import type { Accent, Density } from "@/domain/settings";
import {
  THEME_INFO,
  THEMES,
  resolveTheme,
  type Theme,
  type ThemeChoice,
  type ThemeMode,
} from "@/domain/themes";
import { appWindow } from "@/platform/desktop";
import { useSettings } from "./use-settings";

/**
 * Last applied theme, read by main.tsx before the first paint so the boot screen already has the
 * right colors. Only a hint: the setting in SQLite is the source of truth.
 */
const THEME_HINT_KEY = "tf.theme";

export interface Appearance {
  theme: Theme;
  accent: Accent;
  density: Density;
}

export function applyAppearance({ theme, accent, density }: Appearance): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = THEME_INFO[theme].mode;
  root.dataset.accent = accent;
  root.dataset.density = density;
  try {
    localStorage.setItem(THEME_HINT_KEY, theme);
  } catch {
    // Storage unavailable: the boot screen just starts in the default theme.
  }
}

/** Applies the theme hint from the last run (see THEME_HINT_KEY). Call before rendering. */
export function applyThemeHint(): void {
  let hint: string | null = null;
  try {
    hint = localStorage.getItem(THEME_HINT_KEY);
  } catch {
    return;
  }
  const theme = THEMES.find((t) => t === hint);
  if (theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = THEME_INFO[theme].mode;
  }
}

/**
 * Matches the native window to a theme choice: title bar and background color. For "system" the
 * window follows Windows, and the resolved mode is read back from it. Returns the theme to show.
 */
export async function syncWindowTheme(choice: ThemeChoice): Promise<Theme> {
  await appWindow.setTheme(choice === "system" ? null : THEME_INFO[choice].mode);
  const theme = resolveTheme(choice, choice === "system" ? await appWindow.systemMode() : "dark");
  await appWindow.setBackground(THEME_INFO[theme].preview.canvas);
  return theme;
}

/** Keeps <html data-theme/mode/accent/density> and the native window in sync with settings. */
export function useAppearanceSync(): void {
  const settings = useSettings();
  const choice = settings["ui.theme"];
  const accent = settings["ui.accent"];
  const density = settings["ui.density"];
  const [systemMode, setSystemMode] = useState<ThemeMode | null>(null);

  // Native window first; for "system" this also tells us which mode Windows is in.
  useEffect(() => {
    let cancelled = false;
    void syncWindowTheme(choice)
      .then((theme) => {
        if (!cancelled && choice === "system") setSystemMode(THEME_INFO[theme].mode);
      })
      .catch(() => undefined);
    if (choice !== "system") return () => void (cancelled = true);
    const unlisten = appWindow.onSystemModeChanged((mode) => {
      if (cancelled) return;
      setSystemMode(mode);
      void appWindow.setBackground(THEME_INFO[mode].preview.canvas).catch(() => undefined);
    });
    return () => {
      cancelled = true;
      void unlisten.then((stop) => stop());
    };
  }, [choice]);

  const current = document.documentElement.dataset.mode === "light" ? "light" : "dark";
  const theme = resolveTheme(choice, systemMode ?? current);
  useEffect(() => applyAppearance({ theme, accent, density }), [theme, accent, density]);
}

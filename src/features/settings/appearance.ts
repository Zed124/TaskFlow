import { useEffect } from "react";
import type { Accent, Density } from "@/domain/settings";
import { useSettings } from "./use-settings";

export function applyAppearance(accent: Accent, density: Density): void {
  const root = document.documentElement;
  root.dataset.accent = accent;
  root.dataset.density = density;
}

/** Keeps <html data-accent/data-density> in sync with persisted settings. */
export function useAppearanceSync(): void {
  const settings = useSettings();
  const accent = settings["ui.accent"];
  const density = settings["ui.density"];
  useEffect(() => applyAppearance(accent, density), [accent, density]);
}

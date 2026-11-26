/**
 * Color themes. The palettes themselves live in src/styles/index.css (one block of CSS variables
 * per theme); this file holds what code needs to know about them: the list, which ones are light,
 * and a few swatch colors for the Settings previews and the native window background.
 * Keep `preview` in sync with the CSS block (themes.test.ts checks it).
 */
export const THEMES = ["light", "dark", "midnight", "dusk", "paper"] as const;
export type Theme = (typeof THEMES)[number];

/** What the user picks: a theme, or "system" to follow Windows' light/dark setting. */
export const THEME_CHOICES = ["system", ...THEMES] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ThemeMode = "light" | "dark";

export interface ThemeInfo {
  mode: ThemeMode;
  preview: {
    canvas: string;
    sidebar: string;
    surface: string;
    line: string;
    fg: string;
    muted: string;
  };
}

export const THEME_INFO: Record<Theme, ThemeInfo> = {
  light: {
    mode: "light",
    preview: {
      canvas: "#f7f7f9",
      sidebar: "#efeff3",
      surface: "#ffffff",
      line: "#e4e4ea",
      fg: "#17171c",
      muted: "#4f4f5c",
    },
  },
  dark: {
    mode: "dark",
    preview: {
      canvas: "#131318",
      sidebar: "#0f0f13",
      surface: "#19191f",
      line: "#26262f",
      fg: "#e9e9ef",
      muted: "#a1a1b0",
    },
  },
  midnight: {
    mode: "dark",
    preview: {
      canvas: "#08080a",
      sidebar: "#000000",
      surface: "#0f0f12",
      line: "#1e1e24",
      fg: "#ededf1",
      muted: "#a6a6b3",
    },
  },
  dusk: {
    mode: "dark",
    preview: {
      canvas: "#10141f",
      sidebar: "#0c1019",
      surface: "#151a27",
      line: "#232a3b",
      fg: "#e4e8f1",
      muted: "#a3acc1",
    },
  },
  paper: {
    mode: "light",
    preview: {
      canvas: "#f4f0e8",
      sidebar: "#ebe5d9",
      surface: "#fbf9f4",
      line: "#e2dacb",
      fg: "#2b2520",
      muted: "#5a5044",
    },
  },
};

/** The theme to show for a choice; "system" maps to Light or Dark by the Windows setting. */
export function resolveTheme(choice: ThemeChoice, systemMode: ThemeMode): Theme {
  return choice === "system" ? systemMode : choice;
}

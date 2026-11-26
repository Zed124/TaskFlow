import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_CHOICES, THEME_INFO, THEMES, resolveTheme } from "./themes";
import { settingDefinitions } from "./settings";

const css = readFileSync("src/styles/index.css", "utf8").replace(/\r\n/g, "\n");
const rust = readFileSync("src-tauri/src/desktop.rs", "utf8");

/** The `--tf-*` variables declared in a theme's CSS block. */
function themeVars(theme: string): Record<string, string> {
  const selector = theme === "dark" ? ':root,\n[data-theme="dark"]' : `[data-theme="${theme}"]`;
  const start = css.indexOf(`${selector} {`);
  expect(start, `CSS block for ${theme}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--tf-([\w-]+):\s*([^;]+);/g)].map((m): [string, string] => [
      m[1] ?? "",
      m[2] ?? "",
    ]),
  );
}

describe("themes", () => {
  it("every theme has a full CSS block that matches its preview colors", () => {
    const reference = Object.keys(themeVars("dark")).sort();
    for (const theme of THEMES) {
      const vars = themeVars(theme);
      expect(Object.keys(vars).sort(), theme).toEqual(reference);
      const { preview } = THEME_INFO[theme];
      expect(vars.canvas).toBe(preview.canvas);
      expect(vars.sidebar).toBe(preview.sidebar);
      expect(vars.surface).toBe(preview.surface);
      expect(vars.line).toBe(preview.line);
      expect(vars.fg).toBe(preview.fg);
      expect(vars["fg-muted"]).toBe(preview.muted);
    }
  });

  it("the native window background in Rust matches each theme's canvas", () => {
    for (const theme of THEMES) {
      expect(rust).toContain(`("${theme}", "${THEME_INFO[theme].preview.canvas}")`);
    }
  });

  it("resolves System to Windows' mode and keeps explicit choices", () => {
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("paper", "dark")).toBe("paper");
    expect(THEME_INFO.paper.mode).toBe("light");
    expect(THEME_INFO.dusk.mode).toBe("dark");
  });

  it("defaults to Dark and accepts every choice", () => {
    const def = settingDefinitions["ui.theme"];
    expect(def.default).toBe("dark");
    for (const choice of THEME_CHOICES) expect(def.schema.safeParse(choice).success).toBe(true);
    expect(def.schema.safeParse("neon").success).toBe(false);
  });
});

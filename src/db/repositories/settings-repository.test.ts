import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../executor";
import { createTestDb } from "@/test/test-db";
import { createSettingsRepository, type SettingsRepository } from "./settings-repository";
import { defaultSettings, type SettingKey, type SettingValue } from "@/domain/settings";
import { ValidationError } from "@/lib/errors";

let db: Database;
let repo: SettingsRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = createSettingsRepository(db);
});

describe("settings repository", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await repo.getAll()).toEqual(defaultSettings());
    expect(await repo.get("ui.accent")).toBe("violet");
  });

  it("persists and overwrites values", async () => {
    await repo.set("ui.sidebarCollapsed", true);
    await repo.set("ui.accent", "teal");
    await repo.set("ui.accent", "rose");

    // A new repository instance reads from the DB, like a fresh app launch.
    const reloaded = createSettingsRepository(db);
    expect(await reloaded.get("ui.sidebarCollapsed")).toBe(true);
    expect(await reloaded.get("ui.accent")).toBe("rose");
    expect(await db.select("SELECT key FROM settings")).toHaveLength(2);
  });

  it("rejects invalid values", async () => {
    // Bypass the compile-time types to simulate bad input reaching the repository at runtime.
    const setUnchecked = (k: SettingKey, v: unknown) => repo.set(k, v as never);
    await expect(setUnchecked("ui.accent", "neon")).rejects.toBeInstanceOf(ValidationError);
    await expect(setUnchecked("ui.sidebarCollapsed", "yes")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("falls back to the default when stored data is corrupt or unknown keys exist", async () => {
    await db.execute(
      "INSERT INTO settings (key, value, updated_at) VALUES ('ui.density', '\"huge\"', 'x')",
    );
    await db.execute(
      "INSERT INTO settings (key, value, updated_at) VALUES ('legacy.key', 'true', 'x')",
    );
    const all = await repo.getAll();
    const density: SettingValue<"ui.density"> = all["ui.density"];
    expect(density).toBe("comfortable");
    expect(all).not.toHaveProperty("legacy.key");
  });
});

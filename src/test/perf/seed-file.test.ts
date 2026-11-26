/**
 * Seeds a *separate* database file with a large dataset for manual/automated UI testing at scale.
 * Never touches the real profile. Usage (PowerShell):
 *   $env:PERF_DB = "$env:APPDATA\com.taskflow.perf\taskflow.db"; npx vitest run src/test/perf/seed-file
 *   powershell -File scripts/dev-inspect.ps1 -Identifier com.taskflow.perf
 */
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { it } from "vitest";
import { Database } from "@/db/executor";
import { createNodeDriver } from "@/db/drivers/node-driver";
import { migrate } from "@/db/migrator";
import { migrations } from "@/db/migrations";
import { seedLargeDataset } from "./seed";

const target = process.env.PERF_DB;

it.skipIf(!target)(
  "seeds the perf database file",
  async () => {
    const path = target ?? "";
    if (!/com\.taskflow\.perf/.test(path))
      throw new Error("Refusing to seed anything but the perf profile");
    mkdirSync(dirname(path), { recursive: true });
    for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });
    const driver = createNodeDriver(path);
    const db = new Database(driver);
    await migrate(db, migrations);
    await seedLargeDataset(db, { tasks: Number(process.env.PERF_TASKS ?? 10_000) });
    await db.execute(
      "INSERT INTO settings (key, value, updated_at) VALUES ('onboarding.completed', 'true', ?), ('backup.auto', 'false', ?)",
      [new Date().toISOString(), new Date().toISOString()],
    );
    driver.close();
  },
  180_000,
);

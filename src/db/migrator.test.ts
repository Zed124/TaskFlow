import { describe, expect, it, vi } from "vitest";
import { Database } from "./executor";
import { createNodeDriver } from "./drivers/node-driver";
import { migrate, MigrationError, parseMigrations, type Migration } from "./migrator";
import { migrations } from "./migrations";

const m = (version: number, sql: string): Migration => ({ version, name: `m${version}`, sql });

describe("parseMigrations", () => {
  it("orders files and extracts version and name", () => {
    const parsed = parseMigrations({
      "./0002_second.sql": "B",
      "./0001_first.sql": "A",
    });
    expect(parsed.map((p) => [p.version, p.name, p.sql])).toEqual([
      [1, "first", "A"],
      [2, "second", "B"],
    ]);
  });

  it("rejects gaps and bad names", () => {
    expect(() => parseMigrations({ "./0002_x.sql": "" })).toThrow(MigrationError);
    expect(() => parseMigrations({ "./init.sql": "" })).toThrow(MigrationError);
  });
});

describe("migrate", () => {
  it("applies the real migrations to an empty database and is idempotent", async () => {
    const db = new Database(createNodeDriver());
    const first = await migrate(db, migrations);
    expect(first.applied.length).toBe(migrations.length);
    expect(first.currentVersion).toBe(migrations.length);

    const second = await migrate(db, migrations);
    expect(second.applied).toHaveLength(0);

    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "activity_events",
        "backup_runs",
        "categories",
        "completion_events",
        "notification_log",
        "projects",
        "schema_migrations",
        "search_index",
        "settings",
        "status_intervals",
        "tasks",
        "work_segments",
        "work_sessions",
      ]),
    );
  });

  it("applies only pending migrations and calls beforeApply for existing databases", async () => {
    const db = new Database(createNodeDriver());
    await migrate(db, [m(1, "CREATE TABLE a (x INTEGER);")]);

    const beforeApply = vi.fn(() => Promise.resolve());
    const result = await migrate(
      db,
      [m(1, "CREATE TABLE a (x INTEGER);"), m(2, "CREATE TABLE b (y INTEGER);")],
      {
        beforeApply,
      },
    );

    expect(result.applied.map((x) => x.version)).toEqual([2]);
    expect(beforeApply).toHaveBeenCalledOnce();
    expect(beforeApply).toHaveBeenCalledWith([expect.objectContaining({ version: 2 })], 1);
  });

  it("does not call beforeApply for a brand-new database", async () => {
    const beforeApply = vi.fn(() => Promise.resolve());
    await migrate(new Database(createNodeDriver()), [m(1, "CREATE TABLE a (x INTEGER);")], {
      beforeApply,
    });
    expect(beforeApply).not.toHaveBeenCalled();
  });

  it("rolls back a failing migration completely", async () => {
    const db = new Database(createNodeDriver());
    await expect(
      migrate(db, [m(1, "CREATE TABLE a (x INTEGER); CREATE TABLE a (x INTEGER);")]),
    ).rejects.toBeInstanceOf(MigrationError);

    const tables = await db.select("SELECT name FROM sqlite_master WHERE name = 'a'");
    expect(tables).toHaveLength(0);
    expect(await db.select("SELECT * FROM schema_migrations")).toHaveLength(0);
  });

  it("refuses to run against a database from a newer app version", async () => {
    const db = new Database(createNodeDriver());
    await migrate(db, [m(1, "SELECT 1;"), m(2, "SELECT 1;")]);
    await expect(migrate(db, [m(1, "SELECT 1;")])).rejects.toThrow(/newer version/);
  });
});

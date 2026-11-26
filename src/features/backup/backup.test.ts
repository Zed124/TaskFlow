import { describe, expect, it } from "vitest";
import { createServices } from "@/app/services";
import { createTestDb } from "@/test/test-db";
import { createTestServices, MINUTE } from "@/test/test-services";
import { backupFileName, backupsToPrune, isBackupDue, validateBackup } from "@/domain/backup";
import { csvField, toCsv } from "./csv-export";

async function seedRichData() {
  const ctx = await createTestServices();
  const { services, clock } = ctx;
  const project = await services.projects.create({ name: "Home", description: "House things" });
  const category = await services.categories.create({ name: "Errands" });
  const parent = await services.tasks.create({
    title: "Renovate kitchen",
    projectId: project.id,
    categoryId: category.id,
    dueDate: "2026-12-01",
    dueTime: "09:30",
  });
  const sub = await services.tasks.addSubtask(parent.id, "Pick tiles");
  await services.tasks.setStatus(parent.id, "in_progress");
  await services.timer.start(parent.id);
  clock.advance(20 * MINUTE);
  await services.timer.stop();
  await services.tasks.setStatus(sub.id, "completed");
  await services.tasks.setStatus(sub.id, "todo");
  await services.tasks.setStatus(sub.id, "completed");
  await services.activity.addNote(parent.id, "Measured the walls");
  await services.settings.set("ui.accent", "teal");
  const deleted = await services.tasks.create({ title: "Old idea" });
  await services.tasks.delete(deleted.id);
  return { ...ctx, project, parent, sub };
}

describe("backup export and restore", () => {
  it("round-trips everything losslessly into an empty database", async () => {
    const { services } = await seedRichData();
    const doc = await services.backup.exportDocument();
    const validated = validateBackup(JSON.parse(JSON.stringify(doc)), 1);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.summary.counts).toMatchObject({
      projects: 1,
      categories: 1,
      tasks: 3,
      completion_events: 2,
    });
    expect(validated.summary.activeTasks).toBe(1);

    const target = createServices(await createTestDb());
    await target.backup.restore(validated.document);
    const again = await target.backup.exportDocument();
    expect(again.data).toEqual(doc.data);

    // Derived state works after restore: search index rebuilt, history intact.
    expect((await target.search.search("walls")).map((h) => h.kind)).toEqual(["note"]);
    expect((await target.settings.getAll())["ui.accent"]).toBe("teal");
    const details = await target.tasks.list({ anyLevel: true, includeArchived: true });
    expect(details.map((t) => t.title).sort()).toEqual(["Pick tiles", "Renovate kitchen"]);
  });

  it("replaces existing data rather than merging", async () => {
    const { services } = await seedRichData();
    const doc = await services.backup.exportDocument();
    const other = await createTestServices();
    await other.services.tasks.create({ title: "Will be replaced" });
    await other.services.backup.restore(doc);
    const titles = (await other.services.tasks.list()).map((t) => t.title);
    expect(titles).toEqual(["Renovate kitchen"]);
  });

  it("rolls back completely when a restore fails midway", async () => {
    const { services, db } = await seedRichData();
    const doc = await services.backup.exportDocument();
    const broken = structuredClone(doc);
    // Passes structure checks but violates a DB constraint (two open completions).
    broken.data.completion_events = broken.data.completion_events.map((c) => ({
      ...c,
      reopened_at: null,
    }));
    await expect(services.backup.restore(broken)).rejects.toThrow();
    expect(await db.select("SELECT id FROM tasks")).toHaveLength(3);
  });

  it("rejects malformed, foreign, broken or newer backups with readable errors", async () => {
    const { services } = await seedRichData();
    const doc = JSON.parse(JSON.stringify(await services.backup.exportDocument())) as Record<
      string,
      unknown
    > & {
      data: { tasks: { project_id: string | null }[] };
    };

    expect(validateBackup({ hello: "world" }, 1)).toEqual({
      ok: false,
      errors: ["This file is not a TaskFlow backup."],
    });
    expect(validateBackup({ ...doc, formatVersion: 99 }, 1).ok).toBe(false);
    const newer = validateBackup({ ...doc, schemaVersion: 2 }, 1);
    expect(!newer.ok && newer.errors[0]).toMatch(/newer TaskFlow/);

    const dangling = structuredClone(doc);
    dangling.data.tasks[0]!.project_id = "missing-project";
    const result = validateBackup(dangling, 1);
    expect(!result.ok && result.errors.join(" ")).toMatch(/unknown project missing-project/);
  });
});

describe("backup scheduling helpers", () => {
  it("names files so they sort chronologically", () => {
    expect(backupFileName("auto", new Date(2026, 10, 26, 9, 5, 7))).toBe(
      "taskflow-backup-auto-20261126-090507.json",
    );
    expect(backupFileName(null, new Date(2026, 0, 2, 3, 4, 5))).toBe(
      "taskflow-backup-20260102-030405.json",
    );
  });

  it("decides when an automatic backup is due", () => {
    const now = new Date("2026-11-26T12:00:00.000Z");
    expect(isBackupDue(null, 24, now)).toBe(true);
    expect(isBackupDue("2026-11-26T00:00:00.000Z", 24, now)).toBe(false);
    expect(isBackupDue("2026-11-25T12:00:00.000Z", 24, now)).toBe(true);
  });

  it("prunes only old automatic backups", () => {
    const names = [
      "taskflow-backup-auto-20261120-090000.json",
      "taskflow-backup-auto-20261122-090000.json",
      "taskflow-backup-auto-20261126-090000.json",
      "taskflow-backup-20261101-120000.json",
      "taskflow-backup-pre-restore-20261101-120000.json",
    ];
    expect(backupsToPrune(names, 2)).toEqual(["taskflow-backup-auto-20261120-090000.json"]);
    expect(backupsToPrune(names, 0)).toHaveLength(2); // always keeps at least one
  });
});

describe("CSV export", () => {
  it("quotes, escapes and neutralizes formulas", () => {
    expect(csvField('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField("@sum")).toBe("'@sum");
    expect(csvField(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a,b\r\n1,x\r\n");
  });

  it("exports non-deleted tasks with project, parent and tracked minutes", async () => {
    const { services } = await seedRichData();
    const { csv, rows } = await services.backup.exportTasksCsv();
    expect(rows).toBe(2);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toMatch(/^Title,Status,Priority/);
    expect(lines[1]).toMatch(
      /^Renovate kitchen,in_progress,medium,2026-12-01,09:30,Home,Errands,,/,
    );
    expect(lines[1]).toContain(",20,");
    expect(lines[2]).toMatch(/^Pick tiles,completed,.*,Renovate kitchen,/);
    expect(csv).not.toContain("Old idea");
  });
});

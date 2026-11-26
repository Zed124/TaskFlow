/**
 * Seeds a *separate* demo profile with a small, realistic dataset (six weeks of history) for
 * README screenshots. Everything is written through the real services with a moving clock, so
 * history, completions, status time and tracked work look like real use.
 * Never touches the real profile. Usage (PowerShell):
 *   $env:DEMO_DB = "$env:APPDATA\com.taskflow.demo\taskflow.db"; npx vitest run src/test/demo
 *   powershell -File scripts/dev-inspect.ps1 -Identifier com.taskflow.demo
 */
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { it } from "vitest";
import { Database } from "@/db/executor";
import { createNodeDriver } from "@/db/drivers/node-driver";
import { migrate } from "@/db/migrator";
import { migrations } from "@/db/migrations";
import { createServices } from "@/app/services";
import { toIsoInstant, toLocalDate, type Clock } from "@/lib/time";
import type { TaskPriority } from "@/domain/task";

const target = process.env.DEMO_DB;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

it.skipIf(!target)(
  "seeds the demo database file",
  async () => {
    const path = target ?? "";
    if (!/com\.taskflow\.demo/.test(path))
      throw new Error("Refusing to seed anything but the demo profile");
    mkdirSync(dirname(path), { recursive: true });
    for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });

    const real = new Date();
    const today9 = new Date(real.getFullYear(), real.getMonth(), real.getDate(), 9).getTime();
    let now = today9 - 42 * DAY;
    const clock: Clock = { now: () => new Date(now) };
    const driver = createNodeDriver(path);
    const db = new Database(driver);
    await migrate(db, migrations);
    const s = createServices(db, clock);
    const date = (offsetDays: number) => toLocalDate(new Date(today9 + offsetDays * DAY));

    let state = 7;
    const rand = () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };

    const work = await s.categories.create({ name: "Work", color: "blue" });
    const home = await s.categories.create({ name: "Home", color: "green" });
    const health = await s.categories.create({ name: "Health", color: "rose" });
    const learning = await s.categories.create({ name: "Learning", color: "amber" });

    const launch = await s.projects.create({
      name: "Website relaunch",
      description: "New marketing site, docs and pricing page.",
      color: "violet",
    });
    const move = await s.projects.create({
      name: "Apartment move",
      description: "Everything for the move on the 15th.",
      color: "teal",
    });
    const fitness = await s.projects.create({
      name: "Half marathon",
      description: "Training plan for the spring race.",
      color: "orange",
    });
    const reading = await s.projects.create({
      name: "Reading list",
      description: "Books for this quarter.",
      color: "pink",
    });

    // Six weeks of finished work: created, started, worked on, completed.
    const history: [string, string, string, TaskPriority][] = [
      ["Write homepage copy", launch.id, work.id, "high"],
      ["Pick a hosting provider", launch.id, work.id, "medium"],
      ["Design pricing table", launch.id, work.id, "high"],
      ["Set up analytics", launch.id, work.id, "low"],
      ["Migrate blog posts", launch.id, work.id, "medium"],
      ["Review accessibility report", launch.id, work.id, "high"],
      ["Compress hero images", launch.id, work.id, "low"],
      ["Get three moving quotes", move.id, home.id, "high"],
      ["Order packing boxes", move.id, home.id, "medium"],
      ["Update address with the bank", move.id, home.id, "medium"],
      ["Book the elevator for move day", move.id, home.id, "urgent"],
      ["Sell the old bookshelf", move.id, home.id, "low"],
      ["5 km easy run", fitness.id, health.id, "medium"],
      ["Interval session", fitness.id, health.id, "medium"],
      ["Buy new running shoes", fitness.id, health.id, "high"],
      ["10 km long run", fitness.id, health.id, "medium"],
      ["Stretching routine", fitness.id, health.id, "low"],
      ["Finish 'Deep Work'", reading.id, learning.id, "medium"],
      ["Notes on 'The Pragmatic Programmer'", reading.id, learning.id, "low"],
      ["Renew car insurance", "", home.id, "high"],
      ["Dentist check-up", "", health.id, "medium"],
      ["Quarterly expense report", "", work.id, "high"],
      ["Prepare sprint demo", "", work.id, "medium"],
      ["Fix login timeout bug", "", work.id, "urgent"],
      ["Call the landlord about the heater", "", home.id, "medium"],
      ["Back up photos", "", home.id, "low"],
      ["Rust ownership chapter", "", learning.id, "medium"],
      ["Plan team offsite agenda", "", work.id, "medium"],
    ];
    for (let day = 0; day < 41; day++) {
      const dayStart = today9 - (41 - day) * DAY;
      const perDay = 1 + Math.floor(rand() * 3) + (day > 25 ? 1 : 0);
      for (let k = 0; k < perDay; k++) {
        const [title, projectId, categoryId, priority] = history[
          Math.floor(rand() * history.length)
        ] as (typeof history)[number];
        now = dayStart - Math.floor(rand() * 4) * DAY;
        const t = await s.tasks.create({
          title,
          priority,
          projectId: projectId || null,
          categoryId,
          dueDate: toLocalDate(new Date(dayStart + Math.floor(rand() * 2) * DAY)),
        });
        now = dayStart + Math.floor(rand() * 3) * HOUR;
        await s.tasks.setStatus(t.id, "in_progress");
        if (rand() < 0.7) {
          await s.timer.start(t.id);
          now += (20 + Math.floor(rand() * 100)) * 60_000;
          await s.timer.stop();
        }
        now = dayStart + (3 + Math.floor(rand() * 6)) * HOUR;
        await s.tasks.setStatus(t.id, "completed");
      }
    }
    // Keep the finished history out of the open lists, as a real user would.
    now = today9 - 7 * DAY;
    await s.tasks.archiveCompleted({ completedBefore: toIsoInstant(new Date(today9)) });

    // What is on the plate now.
    now = today9 - 3 * DAY;
    const open: {
      title: string;
      project?: string;
      category: string;
      priority: TaskPriority;
      due?: number;
      time?: string;
      status?: "in_progress";
      description?: string;
      subtasks?: [string, boolean][];
    }[] = [
      {
        title: "Launch the new pricing page",
        project: launch.id,
        category: work.id,
        priority: "urgent",
        due: 0,
        time: "16:00",
        status: "in_progress",
        description: "Ship behind the feature flag first, then switch DNS after the smoke test.",
        subtasks: [
          ["Final copy review", true],
          ["Stripe test checkout", true],
          ["Smoke test on staging", false],
          ["Flip the feature flag", false],
        ],
      },
      {
        title: "Write the docs landing page",
        project: launch.id,
        category: work.id,
        priority: "high",
        due: 2,
        status: "in_progress",
      },
      {
        title: "Set up redirects from old URLs",
        project: launch.id,
        category: work.id,
        priority: "medium",
        due: 4,
      },
      {
        title: "Announce the relaunch",
        project: launch.id,
        category: work.id,
        priority: "medium",
        due: 7,
      },
      { title: "Pay electricity bill", category: home.id, priority: "high", due: 0, time: "12:00" },
      {
        title: "Pack the kitchen",
        project: move.id,
        category: home.id,
        priority: "medium",
        due: 3,
      },
      {
        title: "Transfer internet contract",
        project: move.id,
        category: home.id,
        priority: "high",
        due: -1,
      },
      {
        title: "Book movers",
        project: move.id,
        category: home.id,
        priority: "urgent",
        due: 1,
        time: "10:00",
      },
      {
        title: "Long run, 16 km",
        project: fitness.id,
        category: health.id,
        priority: "medium",
        due: 2,
        time: "07:00",
      },
      {
        title: "Physio appointment",
        category: health.id,
        priority: "medium",
        due: 5,
        time: "14:30",
      },
      {
        title: "Read 'Designing Data-Intensive Applications'",
        project: reading.id,
        category: learning.id,
        priority: "low",
        status: "in_progress",
      },
      { title: "Submit conference talk proposal", category: work.id, priority: "high", due: -2 },
      { title: "Renew passport", category: home.id, priority: "medium", due: 12 },
      { title: "Grocery run", category: home.id, priority: "low", due: 0 },
      { title: "1:1 prep with Sam", category: work.id, priority: "medium", due: 1, time: "11:00" },
    ];
    const ids: Record<string, string> = {};
    for (const [i, o] of open.entries()) {
      now = today9 - (6 - (i % 6)) * DAY + (i % 3) * HOUR;
      const t = await s.tasks.create({
        title: o.title,
        priority: o.priority,
        projectId: o.project ?? null,
        categoryId: o.category,
        dueDate: o.due === undefined ? null : date(o.due),
        dueTime: o.time ?? null,
        description: o.description ?? "",
      });
      ids[o.title] = t.id;
      for (const [sub, done] of o.subtasks ?? []) {
        const st = await s.tasks.addSubtask(t.id, sub);
        if (done) await s.tasks.setStatus(st.id, "completed");
      }
      if (o.status) {
        now += 2 * HOUR;
        await s.tasks.setStatus(t.id, o.status);
      }
    }
    const pricing = ids["Launch the new pricing page"] ?? "";
    now = today9 - 1 * DAY;
    await s.activity.addNote(
      pricing,
      "Marketing signed off on the copy. Waiting on the final Stripe keys.",
    );
    await s.timer.start(pricing);
    now += 95 * 60_000;
    await s.timer.stop();

    const skipped = await s.tasks.create({ title: "Repaint the balcony", categoryId: home.id });
    await s.tasks.setStatus(skipped.id, "cancelled");

    // A few things finished today, so the dashboard has a pulse.
    now = today9;
    const doneToday: [string, string][] = [
      ["Morning run, 6 km", health.id],
      ["Reply to design feedback", work.id],
      ["Water the plants", home.id],
    ];
    for (const [title, categoryId] of doneToday) {
      const t = await s.tasks.create({ title, categoryId });
      now += 40 * 60_000;
      await s.tasks.setStatus(t.id, "completed");
    }

    await s.settings.set("onboarding.completed", true);
    await s.settings.set("backup.auto", false);
    await s.settings.set("notifications.enabled", false);
    driver.close();
  },
  180_000,
);

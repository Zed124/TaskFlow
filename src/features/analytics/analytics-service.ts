import { addDays } from "date-fns";
import type { SqlExecutor } from "@/db/executor";
import { createAnalyticsRepository } from "@/db/repositories/analytics-repository";
import { createProjectRepository } from "@/db/repositories/project-repository";
import {
  bucketStart,
  bucketsInRange,
  mean,
  median,
  splitByLocalDay,
  type DateRange,
  type Granularity,
} from "@/domain/analytics";
import type { EntityColor } from "@/domain/colors";
import type { WeekStart } from "@/domain/settings";
import { TASK_PRIORITIES, type TaskPriority } from "@/domain/task";
import { parseLocalDate } from "@/lib/format";
import { toLocalDate, type Clock, type LocalDate } from "@/lib/time";

export interface TrendPoint {
  key: LocalDate;
  /** Distinct tasks completed in the period (a task counts once per period). */
  completed: number;
  created: number;
  trackedMs: number;
}

export interface ProjectStat {
  id: string | null;
  name: string | null;
  color: EntityColor | null;
  archived: boolean;
  open: number;
  completed: number;
  trackedMs: number;
  medianLeadMs: number | null;
}

export interface AnalyticsReport {
  range: DateRange;
  granularity: Granularity;
  totals: {
    completed: number;
    created: number;
    trackedMs: number;
    /** Lead time = creation → first completion, for tasks first completed in range. */
    lead: { medianMs: number | null; meanMs: number | null; sample: number };
    /** Status duration in In Progress, for completed tasks that were ever in progress. */
    inProgress: { medianMs: number | null; meanMs: number | null; sample: number; ongoing: number };
  };
  trend: TrendPoint[];
  byPriority: { priority: TaskPriority; open: number; completed: number }[];
  projects: ProjectStat[];
}

/**
 * Productivity analytics. Two time measures are kept strictly apart:
 *  - status duration: time a task sat in In Progress (automatic, says nothing about effort);
 *  - tracked work: sessions recorded with the manual timer.
 */
export function createAnalyticsService(db: SqlExecutor, clock: Clock) {
  const repo = createAnalyticsRepository(db);
  const projectsRepo = createProjectRepository(db);

  return {
    async report(
      range: DateRange,
      granularity: Granularity,
      weekStartsOn: WeekStart,
    ): Promise<AnalyticsReport> {
      const now = clock.now();
      const fromInstant = parseLocalDate(range.from).toISOString();
      const toInstant = addDays(parseLocalDate(range.to), 1).toISOString();
      const bucket = (d: LocalDate) => bucketStart(d, granularity, weekStartsOn);

      const [
        completions,
        created,
        firsts,
        intervals,
        openPriority,
        openProject,
        segments,
        projects,
      ] = await Promise.all([
        repo.completions(range.from, range.to),
        repo.created(fromInstant, toInstant),
        repo.firstCompletions(fromInstant, toInstant),
        repo.inProgressIntervalsOfCompleted(range.from, range.to),
        repo.openByPriority(),
        repo.openByProject(),
        repo.segments(fromInstant, toInstant),
        projectsRepo.list({ includeArchived: true }),
      ]);

      // --- trend ---
      const trend = new Map<LocalDate, TrendPoint & { taskIds: Set<string> }>(
        bucketsInRange(range, granularity, weekStartsOn).map((key) => [
          key,
          { key, completed: 0, created: 0, trackedMs: 0, taskIds: new Set<string>() },
        ]),
      );
      for (const c of completions)
        trend.get(bucket(c.completed_on as LocalDate))?.taskIds.add(c.task_id);
      for (const c of created) {
        const p = trend.get(bucket(toLocalDate(new Date(c.created_at))));
        if (p) p.created += 1;
      }

      // --- tracked work, split across local days, clipped to the range ---
      const rangeStart = new Date(fromInstant);
      const rangeEnd = new Date(toInstant);
      const trackedByProject = new Map<string | null, number>();
      let trackedMs = 0;
      for (const s of segments) {
        const start = maxDate(new Date(s.started_at), rangeStart);
        const end = minDate(s.ended_at ? new Date(s.ended_at) : now, rangeEnd);
        if (end <= start) continue;
        for (const [day, ms] of splitByLocalDay(start, end)) {
          const p = trend.get(bucket(day));
          if (p) p.trackedMs += ms;
          trackedMs += ms;
          trackedByProject.set(s.project_id, (trackedByProject.get(s.project_id) ?? 0) + ms);
        }
      }

      // --- completed totals (distinct tasks in the whole range) ---
      const completedTasks = new Map<
        string,
        { priority: TaskPriority; projectId: string | null }
      >();
      for (const c of completions)
        completedTasks.set(c.task_id, { priority: c.priority, projectId: c.project_id });

      // --- lead time ---
      const leadByProject = new Map<string | null, number[]>();
      const leads = firsts.map((f) => {
        const ms = Math.max(0, Date.parse(f.first_done) - Date.parse(f.created_at));
        leadByProject.set(f.project_id, [...(leadByProject.get(f.project_id) ?? []), ms]);
        return ms;
      });

      // --- in-progress status duration per completed task ---
      const ipByTask = new Map<string, number>();
      let ongoing = 0;
      for (const i of intervals) {
        if (!i.ended_at) ongoing += 1;
        const end = i.ended_at ? Date.parse(i.ended_at) : now.getTime();
        ipByTask.set(
          i.task_id,
          (ipByTask.get(i.task_id) ?? 0) + Math.max(0, end - Date.parse(i.started_at)),
        );
      }
      const ipValues = [...ipByTask.values()];

      // --- priority ---
      const byPriority = [...TASK_PRIORITIES].reverse().map((priority) => ({
        priority,
        open: openPriority.filter((r) => r.priority === priority).reduce((s, r) => s + r.n, 0),
        completed: [...completedTasks.values()].filter((c) => c.priority === priority).length,
      }));

      // --- projects ---
      const completedByProject = new Map<string | null, number>();
      for (const c of completedTasks.values()) {
        completedByProject.set(c.projectId, (completedByProject.get(c.projectId) ?? 0) + 1);
      }
      const openByProject = new Map(openProject.map((r) => [r.project_id, r.n]));
      const stat = (
        id: string | null,
      ): Omit<ProjectStat, "name" | "color" | "archived" | "id"> => ({
        open: openByProject.get(id) ?? 0,
        completed: completedByProject.get(id) ?? 0,
        trackedMs: trackedByProject.get(id) ?? 0,
        medianLeadMs: median(leadByProject.get(id) ?? []),
      });
      const projectStats: ProjectStat[] = [
        ...projects.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          archived: p.archivedAt !== null,
          ...stat(p.id),
        })),
        { id: null, name: null, color: null, archived: false, ...stat(null) },
      ].filter((p) => p.open + p.completed + p.trackedMs > 0 || (p.id !== null && !p.archived));

      return {
        range,
        granularity,
        totals: {
          completed: completedTasks.size,
          created: created.length,
          trackedMs,
          lead: { medianMs: median(leads), meanMs: mean(leads), sample: leads.length },
          inProgress: {
            medianMs: median(ipValues),
            meanMs: mean(ipValues),
            sample: ipValues.length,
            ongoing,
          },
        },
        trend: [...trend.values()].map(({ taskIds, ...p }) => ({ ...p, completed: taskIds.size })),
        byPriority,
        projects: projectStats.sort((a, b) => b.completed - a.completed || b.open - a.open),
      };
    },
  };
}

const maxDate = (a: Date, b: Date) => (a > b ? a : b);
const minDate = (a: Date, b: Date) => (a < b ? a : b);

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;

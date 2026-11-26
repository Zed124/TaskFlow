import { addDays, startOfWeek } from "date-fns";
import type { SqlExecutor } from "@/db/executor";
import { createStatsRepository } from "@/db/repositories/stats-repository";
import type { WeekStart } from "@/domain/settings";
import { toLocalDate, type Clock, type LocalDate } from "@/lib/time";

export interface DashboardStats {
  today: LocalDate;
  open: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  completedToday: number;
  completedThisWeek: number;
  /** Oldest first, ending today. */
  lastDays: { date: LocalDate; completed: number }[];
}

export function createStatsService(db: SqlExecutor, clock: Clock) {
  const stats = createStatsRepository(db);

  return {
    async dashboard(weekStartsOn: WeekStart, days = 14): Promise<DashboardStats> {
      const now = clock.now();
      const today = toLocalDate(now);
      const weekStart = toLocalDate(startOfWeek(now, { weekStartsOn }));
      const rangeStart = toLocalDate(addDays(now, -(days - 1)));
      const from = weekStart < rangeStart ? weekStart : rangeStart;

      const [counts, byDay] = await Promise.all([
        stats.openCounts(today),
        stats.completionsByDay(from, today),
      ]);

      const lastDays = Array.from({ length: days }, (_, i) => {
        const date = toLocalDate(addDays(now, i - (days - 1)));
        return { date, completed: byDay.get(date) ?? 0 };
      });
      let completedThisWeek = 0;
      for (const [day, n] of byDay) if (day >= weekStart) completedThisWeek += n;

      return {
        today,
        ...counts,
        completedToday: byDay.get(today) ?? 0,
        completedThisWeek,
        lastDays,
      };
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;

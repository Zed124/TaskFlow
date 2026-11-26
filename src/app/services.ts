import type { SqlExecutor } from "@/db/executor";
import { createActivityService } from "@/features/activity/activity-service";
import { createCategoryService } from "@/features/categories/category-service";
import { createProjectService } from "@/features/projects/project-service";
import { createSearchService } from "@/features/search/search-service";
import { createSettingsService } from "@/features/settings/settings-service";
import { createTaskService } from "@/features/tasks/task-service";
import { systemClock, type Clock } from "@/lib/time";

/**
 * Composition root (like DI registration in Program.cs). Every feature service is created here
 * from the same executor and clock, so tests can build the same graph on an in-memory DB.
 */
export function createServices(db: SqlExecutor, clock: Clock = systemClock) {
  return {
    settings: createSettingsService(db, clock),
    tasks: createTaskService(db, clock),
    projects: createProjectService(db, clock),
    categories: createCategoryService(db, clock),
    activity: createActivityService(db, clock),
    search: createSearchService(db),
  };
}

export type Services = ReturnType<typeof createServices>;

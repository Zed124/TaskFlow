import type { SqlExecutor } from "../executor";
import { createActivityRepository } from "./activity-repository";
import { createCategoryRepository } from "./category-repository";
import { createHistoryRepository } from "./history-repository";
import { createProjectRepository } from "./project-repository";
import { createSearchRepository } from "./search-repository";
import { createTaskRepository } from "./task-repository";
import { createWorkRepository } from "./work-repository";

/**
 * All repositories bound to one executor. Services create a fresh set inside each
 * transaction so every statement of a use case runs on the transaction.
 */
export function createRepositories(db: SqlExecutor) {
  return {
    tasks: createTaskRepository(db),
    history: createHistoryRepository(db),
    activity: createActivityRepository(db),
    projects: createProjectRepository(db),
    categories: createCategoryRepository(db),
    search: createSearchRepository(db),
    work: createWorkRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

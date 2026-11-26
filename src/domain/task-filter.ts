import type { IsoInstant, LocalDate } from "@/lib/time";
import type { TaskPriority, TaskStatus } from "./task";

export const TASK_SORT_FIELDS = [
  "manual",
  "due",
  "priority",
  "created",
  "updated",
  "title",
  "completed",
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

/** Special id meaning "no project" / "no category" inside filter id lists. */
export const NONE = "__none__";

/**
 * Declarative task query. Every field is optional; an empty filter returns all
 * non-deleted, non-archived top-level tasks.
 */
export interface TaskFilter {
  statuses?: readonly TaskStatus[];
  priorities?: readonly TaskPriority[];
  /** Project ids; may include NONE. */
  projectIds?: readonly string[];
  /** Category ids; may include NONE. */
  categoryIds?: readonly string[];
  due?: {
    /** Inclusive bounds on the due date. */
    from?: LocalDate;
    to?: LocalDate;
    /** true: only tasks without a due date. false: only tasks with one. */
    none?: boolean;
  };
  /** Bounds on the current completion instant (`completed_at`): from inclusive, to exclusive. */
  completed?: { from?: IsoInstant; to?: IsoInstant };
  /** Free text, matched with full-text search across title, description, notes and task notes. */
  text?: string;
  /** Default false. */
  includeArchived?: boolean;
  /** Default: top-level tasks only (null). Pass a task id to list its subtasks. */
  parentId?: string | null;
  /** When true, ignores `parentId` and returns tasks at every level. */
  anyLevel?: boolean;
  sort?: { field: TaskSortField; direction: "asc" | "desc" };
  limit?: number;
}

export function isFilterEmpty(f: TaskFilter): boolean {
  return (
    !f.statuses?.length &&
    !f.priorities?.length &&
    !f.projectIds?.length &&
    !f.categoryIds?.length &&
    !f.due &&
    !f.completed &&
    !f.text?.trim() &&
    !f.includeArchived
  );
}

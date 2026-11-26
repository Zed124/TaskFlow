import type { Task, TaskListItem, TaskPriority, TaskStatus } from "@/domain/task";
import { NONE, type TaskFilter, type TaskSortField } from "@/domain/task-filter";
import type { IsoInstant, LocalDate } from "@/lib/time";
import type { SqlExecutor, SqlValue } from "../executor";
import { placeholders, toFtsQuery, updateById } from "../sql";

type TaskRow = {
  id: string;
  parent_id: string | null;
  project_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  due_time: string | null;
  remind_at: string | null;
  sort_order: number;
  status_changed_at: string;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TaskListRow = TaskRow & {
  project_name: string | null;
  category_name: string | null;
  category_color: string | null;
  subtask_count: number;
  subtask_done_count: number;
};

const COLUMNS = `t.id, t.parent_id, t.project_id, t.category_id, t.title, t.description, t.notes,
  t.status, t.priority, t.due_date, t.due_time, t.remind_at, t.sort_order, t.status_changed_at,
  t.completed_at, t.archived_at, t.created_at, t.updated_at, t.deleted_at`;

const LIST_COLUMNS = `${COLUMNS},
  p.name AS project_name,
  CASE WHEN c.deleted_at IS NULL THEN c.name END AS category_name,
  CASE WHEN c.deleted_at IS NULL THEN c.color END AS category_color,
  (SELECT count(*) FROM tasks s WHERE s.parent_id = t.id AND s.deleted_at IS NULL) AS subtask_count,
  (SELECT count(*) FROM tasks s WHERE s.parent_id = t.id AND s.deleted_at IS NULL
     AND s.status = 'completed') AS subtask_done_count`;

const LIST_FROM = `FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN categories c ON c.id = t.category_id`;

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    parentId: r.parent_id,
    projectId: r.project_id,
    categoryId: r.category_id,
    title: r.title,
    description: r.description,
    notes: r.notes,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date as LocalDate | null,
    dueTime: r.due_time,
    remindAt: r.remind_at as IsoInstant | null,
    sortOrder: r.sort_order,
    statusChangedAt: r.status_changed_at as IsoInstant,
    completedAt: r.completed_at as IsoInstant | null,
    archivedAt: r.archived_at as IsoInstant | null,
    createdAt: r.created_at as IsoInstant,
    updatedAt: r.updated_at as IsoInstant,
    deletedAt: r.deleted_at as IsoInstant | null,
  };
}

function mapListItem(r: TaskListRow): TaskListItem {
  return {
    ...mapTask(r),
    projectName: r.project_name,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    subtaskCount: r.subtask_count,
    subtaskDoneCount: r.subtask_done_count,
  };
}

/** camelCase field → column, for the fields services may update. */
const UPDATABLE = {
  parentId: "parent_id",
  projectId: "project_id",
  categoryId: "category_id",
  title: "title",
  description: "description",
  notes: "notes",
  status: "status",
  priority: "priority",
  dueDate: "due_date",
  dueTime: "due_time",
  remindAt: "remind_at",
  sortOrder: "sort_order",
  statusChangedAt: "status_changed_at",
  completedAt: "completed_at",
  archivedAt: "archived_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
} as const satisfies Partial<Record<keyof Task, string>>;

export type TaskColumns = { -readonly [K in keyof typeof UPDATABLE]?: Task[K] };

const SORT_SQL: Record<TaskSortField, (dir: "ASC" | "DESC") => string> = {
  manual: (d) => `t.sort_order ${d}, t.created_at DESC`,
  // Undated tasks always go last, whatever the direction.
  due: (d) =>
    `t.due_date IS NULL, t.due_date ${d}, t.due_time IS NULL, t.due_time ${d}, t.created_at DESC`,
  priority: (d) =>
    `CASE t.priority WHEN 'urgent' THEN 3 WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END ${d},
     t.due_date IS NULL, t.due_date ASC, t.created_at DESC`,
  created: (d) => `t.created_at ${d}`,
  updated: (d) => `t.updated_at ${d}`,
  title: (d) => `t.title COLLATE NOCASE ${d}, t.created_at DESC`,
};

/** Builds `WHERE …` + params for a TaskFilter. Exported for tests. */
export function buildTaskWhere(filter: TaskFilter): { where: string; params: SqlValue[] } {
  const clauses: string[] = ["t.deleted_at IS NULL"];
  const params: SqlValue[] = [];

  if (!filter.anyLevel) {
    const parent = filter.parentId ?? null;
    if (parent === null) clauses.push("t.parent_id IS NULL");
    else {
      clauses.push("t.parent_id = ?");
      params.push(parent);
    }
  }

  if (!filter.includeArchived) clauses.push("t.archived_at IS NULL");

  if (filter.statuses?.length) {
    clauses.push(`t.status IN (${placeholders(filter.statuses.length)})`);
    params.push(...filter.statuses);
  }
  if (filter.priorities?.length) {
    clauses.push(`t.priority IN (${placeholders(filter.priorities.length)})`);
    params.push(...filter.priorities);
  }

  const idFilter = (column: string, ids: readonly string[] | undefined) => {
    if (!ids?.length) return;
    const real = ids.filter((id) => id !== NONE);
    const parts: string[] = [];
    if (real.length) {
      parts.push(`${column} IN (${placeholders(real.length)})`);
      params.push(...real);
    }
    if (real.length !== ids.length) parts.push(`${column} IS NULL`);
    clauses.push(`(${parts.join(" OR ")})`);
  };
  idFilter("t.project_id", filter.projectIds);
  // A soft-deleted category counts as "no category".
  if (filter.categoryIds?.length) {
    const real = filter.categoryIds.filter((id) => id !== NONE);
    const parts: string[] = [];
    if (real.length) {
      parts.push(`(t.category_id IN (${placeholders(real.length)}) AND c.deleted_at IS NULL)`);
      params.push(...real);
    }
    if (real.length !== filter.categoryIds.length) {
      parts.push("(t.category_id IS NULL OR c.deleted_at IS NOT NULL)");
    }
    clauses.push(`(${parts.join(" OR ")})`);
  }

  if (filter.due) {
    const { from, to, none } = filter.due;
    if (none === true) clauses.push("t.due_date IS NULL");
    else {
      if (none === false) clauses.push("t.due_date IS NOT NULL");
      if (from) {
        clauses.push("t.due_date >= ?");
        params.push(from);
      }
      if (to) {
        clauses.push("t.due_date <= ?");
        params.push(to);
      }
    }
  }

  const fts = filter.text ? toFtsQuery(filter.text) : null;
  if (fts) {
    // Matches the task's own text and the notes written on its timeline.
    clauses.push(
      `t.id IN (SELECT task_id FROM search_index WHERE search_index MATCH ? AND task_id IS NOT NULL)`,
    );
    params.push(fts);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, params };
}

export function createTaskRepository(db: SqlExecutor) {
  return {
    async insert(task: Task): Promise<void> {
      await db.execute(
        `INSERT INTO tasks (id, parent_id, project_id, category_id, title, description, notes, status,
           priority, due_date, due_time, remind_at, sort_order, status_changed_at, completed_at,
           archived_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.parentId,
          task.projectId,
          task.categoryId,
          task.title,
          task.description,
          task.notes,
          task.status,
          task.priority,
          task.dueDate,
          task.dueTime,
          task.remindAt,
          task.sortOrder,
          task.statusChangedAt,
          task.completedAt,
          task.archivedAt,
          task.createdAt,
          task.updatedAt,
          task.deletedAt,
        ],
      );
    },

    async update(id: string, fields: TaskColumns): Promise<void> {
      const columns: Record<string, SqlValue> = {};
      for (const [key, value] of Object.entries(fields) as [keyof TaskColumns, SqlValue][]) {
        columns[UPDATABLE[key]] = value;
      }
      await updateById(db, "tasks", id, columns);
    },

    async get(id: string, options: { includeDeleted?: boolean } = {}): Promise<Task | null> {
      const rows = await db.select<TaskRow>(
        `SELECT ${COLUMNS} FROM tasks t WHERE t.id = ?${options.includeDeleted ? "" : " AND t.deleted_at IS NULL"}`,
        [id],
      );
      return rows[0] ? mapTask(rows[0]) : null;
    },

    async getListItem(id: string): Promise<TaskListItem | null> {
      const rows = await db.select<TaskListRow>(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE t.id = ? AND t.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ? mapListItem(rows[0]) : null;
    },

    async list(filter: TaskFilter = {}): Promise<TaskListItem[]> {
      const { where, params } = buildTaskWhere(filter);
      const sort = filter.sort ?? { field: "created", direction: "desc" };
      const order = SORT_SQL[sort.field](sort.direction === "asc" ? "ASC" : "DESC");
      const limit = filter.limit ? ` LIMIT ${Math.max(1, Math.floor(filter.limit))}` : "";
      const rows = await db.select<TaskListRow>(
        `SELECT ${LIST_COLUMNS} ${LIST_FROM} ${where} ORDER BY ${order}${limit}`,
        params,
      );
      return rows.map(mapListItem);
    },

    /** Direct children, including archived ones; excludes deleted. */
    async listChildren(
      parentId: string,
      options: { includeDeleted?: boolean } = {},
    ): Promise<Task[]> {
      const rows = await db.select<TaskRow>(
        `SELECT ${COLUMNS} FROM tasks t WHERE t.parent_id = ?${options.includeDeleted ? "" : " AND t.deleted_at IS NULL"}
         ORDER BY t.sort_order ASC, t.created_at ASC`,
        [parentId],
      );
      return rows.map(mapTask);
    },

    async maxSortOrder(parentId: string | null): Promise<number> {
      const rows = await db.select<{ max: number | null }>(
        `SELECT max(sort_order) AS max FROM tasks WHERE ${parentId ? "parent_id = ?" : "parent_id IS NULL"}`,
        parentId ? [parentId] : [],
      );
      return rows[0]?.max ?? 0;
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;

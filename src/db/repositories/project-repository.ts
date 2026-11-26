import type { EntityColor } from "@/domain/colors";
import type { Project, ProjectProgress, ProjectWithProgress } from "@/domain/project";
import type { IsoInstant } from "@/lib/time";
import type { SqlExecutor, SqlValue } from "../executor";
import { updateById } from "../sql";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ProgressRow = ProjectRow & {
  open_count: number;
  in_progress_count: number;
  completed_count: number;
  cancelled_count: number;
};

const COLUMNS = `p.id, p.name, p.description, p.color, p.sort_order, p.archived_at, p.created_at,
  p.updated_at, p.deleted_at`;

/** Counts top-level, non-deleted tasks per status. Archived tasks still count: they are part of the project. */
const PROGRESS = `
  (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.status = 'todo') AS open_count,
  (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.status = 'in_progress') AS in_progress_count,
  (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.status = 'completed') AS completed_count,
  (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.deleted_at IS NULL AND t.status = 'cancelled') AS cancelled_count`;

function mapProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color as EntityColor | null,
    sortOrder: r.sort_order,
    archivedAt: r.archived_at as IsoInstant | null,
    createdAt: r.created_at as IsoInstant,
    updatedAt: r.updated_at as IsoInstant,
    deletedAt: r.deleted_at as IsoInstant | null,
  };
}

function mapWithProgress(r: ProgressRow): ProjectWithProgress {
  const progress: ProjectProgress = {
    open: r.open_count,
    inProgress: r.in_progress_count,
    completed: r.completed_count,
    cancelled: r.cancelled_count,
    total: r.open_count + r.in_progress_count + r.completed_count,
  };
  return { ...mapProject(r), progress };
}

const UPDATABLE = {
  name: "name",
  description: "description",
  color: "color",
  sortOrder: "sort_order",
  archivedAt: "archived_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
} as const satisfies Partial<Record<keyof Project, string>>;

export type ProjectColumns = { -readonly [K in keyof typeof UPDATABLE]?: Project[K] };

export function createProjectRepository(db: SqlExecutor) {
  return {
    async insert(p: Project): Promise<void> {
      await db.execute(
        `INSERT INTO projects (id, name, description, color, sort_order, archived_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          p.description,
          p.color,
          p.sortOrder,
          p.archivedAt,
          p.createdAt,
          p.updatedAt,
          p.deletedAt,
        ],
      );
    },

    async update(id: string, fields: ProjectColumns): Promise<void> {
      const columns: Record<string, SqlValue> = {};
      for (const [key, value] of Object.entries(fields) as [keyof ProjectColumns, SqlValue][]) {
        columns[UPDATABLE[key]] = value;
      }
      await updateById(db, "projects", id, columns);
    },

    async get(id: string, options: { includeDeleted?: boolean } = {}): Promise<Project | null> {
      const rows = await db.select<ProjectRow>(
        `SELECT ${COLUMNS} FROM projects p WHERE p.id = ?${options.includeDeleted ? "" : " AND p.deleted_at IS NULL"}`,
        [id],
      );
      return rows[0] ? mapProject(rows[0]) : null;
    },

    async getWithProgress(id: string): Promise<ProjectWithProgress | null> {
      const rows = await db.select<ProgressRow>(
        `SELECT ${COLUMNS}, ${PROGRESS} FROM projects p WHERE p.id = ? AND p.deleted_at IS NULL`,
        [id],
      );
      return rows[0] ? mapWithProgress(rows[0]) : null;
    },

    async list(options: { includeArchived?: boolean } = {}): Promise<ProjectWithProgress[]> {
      const rows = await db.select<ProgressRow>(
        `SELECT ${COLUMNS}, ${PROGRESS} FROM projects p
         WHERE p.deleted_at IS NULL${options.includeArchived ? "" : " AND p.archived_at IS NULL"}
         ORDER BY p.archived_at IS NOT NULL, p.sort_order, p.name COLLATE NOCASE`,
      );
      return rows.map(mapWithProgress);
    },

    async maxSortOrder(): Promise<number> {
      const rows = await db.select<{ max: number | null }>(
        "SELECT max(sort_order) AS max FROM projects",
      );
      return rows[0]?.max ?? 0;
    },
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;

import type { Category, CategoryWithCount } from "@/domain/category";
import type { EntityColor } from "@/domain/colors";
import type { IsoInstant } from "@/lib/time";
import type { SqlExecutor, SqlValue } from "../executor";
import { updateById } from "../sql";

type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CountRow = CategoryRow & { task_count: number; open_task_count: number };

const COLUMNS =
  "c.id, c.name, c.color, c.sort_order, c.archived_at, c.created_at, c.updated_at, c.deleted_at";

function mapCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    color: r.color as EntityColor | null,
    sortOrder: r.sort_order,
    archivedAt: r.archived_at as IsoInstant | null,
    createdAt: r.created_at as IsoInstant,
    updatedAt: r.updated_at as IsoInstant,
    deletedAt: r.deleted_at as IsoInstant | null,
  };
}

const UPDATABLE = {
  name: "name",
  color: "color",
  sortOrder: "sort_order",
  archivedAt: "archived_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
} as const satisfies Partial<Record<keyof Category, string>>;

export type CategoryColumns = { -readonly [K in keyof typeof UPDATABLE]?: Category[K] };

export function createCategoryRepository(db: SqlExecutor) {
  return {
    async insert(c: Category): Promise<void> {
      await db.execute(
        `INSERT INTO categories (id, name, color, sort_order, archived_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.color, c.sortOrder, c.archivedAt, c.createdAt, c.updatedAt, c.deletedAt],
      );
    },

    async update(id: string, fields: CategoryColumns): Promise<void> {
      const columns: Record<string, SqlValue> = {};
      for (const [key, value] of Object.entries(fields) as [keyof CategoryColumns, SqlValue][]) {
        columns[UPDATABLE[key]] = value;
      }
      await updateById(db, "categories", id, columns);
    },

    async get(id: string, options: { includeDeleted?: boolean } = {}): Promise<Category | null> {
      const rows = await db.select<CategoryRow>(
        `SELECT ${COLUMNS} FROM categories c WHERE c.id = ?${options.includeDeleted ? "" : " AND c.deleted_at IS NULL"}`,
        [id],
      );
      return rows[0] ? mapCategory(rows[0]) : null;
    },

    async findByName(name: string): Promise<Category | null> {
      const rows = await db.select<CategoryRow>(
        `SELECT ${COLUMNS} FROM categories c WHERE c.name = ? COLLATE NOCASE AND c.deleted_at IS NULL`,
        [name.trim()],
      );
      return rows[0] ? mapCategory(rows[0]) : null;
    },

    async list(): Promise<CategoryWithCount[]> {
      const rows = await db.select<CountRow>(
        `SELECT ${COLUMNS},
           (SELECT count(*) FROM tasks t WHERE t.category_id = c.id AND t.deleted_at IS NULL) AS task_count,
           (SELECT count(*) FROM tasks t WHERE t.category_id = c.id AND t.deleted_at IS NULL
              AND t.archived_at IS NULL AND t.status IN ('todo', 'in_progress')) AS open_task_count
         FROM categories c WHERE c.deleted_at IS NULL
         ORDER BY c.sort_order, c.name COLLATE NOCASE`,
      );
      return rows.map((r) => ({
        ...mapCategory(r),
        taskCount: r.task_count,
        openTaskCount: r.open_task_count,
      }));
    },

    async listTaskIds(categoryId: string): Promise<string[]> {
      const rows = await db.select<{ id: string }>(
        "SELECT id FROM tasks WHERE category_id = ? AND deleted_at IS NULL",
        [categoryId],
      );
      return rows.map((r) => r.id);
    },

    async maxSortOrder(): Promise<number> {
      const rows = await db.select<{ max: number | null }>(
        "SELECT max(sort_order) AS max FROM categories",
      );
      return rows[0]?.max ?? 0;
    },
  };
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;

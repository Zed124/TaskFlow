import type { SqlExecutor } from "@/db/executor";
import { createRepositories, type Repositories } from "@/db/repositories";
import type { CategoryColumns } from "@/db/repositories/category-repository";
import type { ActivityEventType, ActivityPayload } from "@/domain/activity";
import {
  createCategorySchema,
  updateCategorySchema,
  type Category,
  type CategoryWithCount,
  type CreateCategoryInput,
  type UpdateCategoryPatch,
} from "@/domain/category";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { nowIso, type Clock, type IsoInstant } from "@/lib/time";
import { parseOrThrow } from "@/lib/validation";

interface Ctx {
  r: Repositories;
  now: IsoInstant;
  groupId: string;
}

async function record<T extends ActivityEventType>(
  ctx: Ctx,
  subject: { kind: "task" | "category"; id: string },
  eventType: T,
  payload: ActivityPayload<T>,
) {
  await ctx.r.activity.insert({
    id: newId(),
    subject,
    eventType,
    payload,
    groupId: ctx.groupId,
    occurredAt: ctx.now,
  });
}

async function requireCategory(r: Repositories, id: string): Promise<Category> {
  const category = await r.categories.get(id);
  if (!category) throw new NotFoundError("Category", id);
  return category;
}

async function assertNameFree(r: Repositories, name: string, exceptId?: string) {
  const existing = await r.categories.findByName(name);
  if (existing && existing.id !== exceptId)
    throw new ConflictError(`A category named "${existing.name}" already exists`);
}

export function createCategoryService(db: SqlExecutor, clock: Clock) {
  const read = createRepositories(db);
  const write = <T>(work: (ctx: Ctx) => Promise<T>) =>
    db.transaction((tx) =>
      work({ r: createRepositories(tx), now: nowIso(clock), groupId: newId() }),
    );

  return {
    list: (): Promise<CategoryWithCount[]> => read.categories.list(),

    async create(input: CreateCategoryInput): Promise<Category> {
      const data = parseOrThrow(createCategorySchema, input);
      return await write(async (ctx) => {
        await assertNameFree(ctx.r, data.name);
        const category: Category = {
          id: newId(),
          name: data.name,
          color: data.color,
          sortOrder: (await ctx.r.categories.maxSortOrder()) + 1,
          archivedAt: null,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          deletedAt: null,
        };
        await ctx.r.categories.insert(category);
        await record(ctx, { kind: "category", id: category.id }, "created", {
          title: category.name,
          parentId: null,
        });
        return category;
      });
    },

    async update(id: string, patch: UpdateCategoryPatch): Promise<Category> {
      const data = parseOrThrow(updateCategorySchema, patch);
      return await write(async (ctx) => {
        const category = await requireCategory(ctx.r, id);
        const columns: CategoryColumns = {};
        if (data.name !== undefined && data.name !== category.name) {
          await assertNameFree(ctx.r, data.name, id);
          columns.name = data.name;
          await record(ctx, { kind: "category", id }, "field_changed", {
            field: "name",
            from: category.name,
            to: data.name,
          });
        }
        if (data.color !== undefined && data.color !== category.color) {
          columns.color = data.color;
          await record(ctx, { kind: "category", id }, "field_changed", {
            field: "color",
            from: category.color,
            to: data.color,
          });
        }
        if (Object.keys(columns).length > 0)
          await ctx.r.categories.update(id, { ...columns, updatedAt: ctx.now });
        return requireCategory(ctx.r, id);
      });
    },

    /** Soft-deletes the category and removes it from its tasks, recording that on each task. */
    delete(id: string): Promise<void> {
      return write(async (ctx) => {
        const category = await requireCategory(ctx.r, id);
        for (const taskId of await ctx.r.categories.listTaskIds(id)) {
          await ctx.r.tasks.update(taskId, { categoryId: null, updatedAt: ctx.now });
          await record(ctx, { kind: "task", id: taskId }, "category_changed", {
            from: { id: category.id, name: category.name },
            to: null,
          });
        }
        await ctx.r.categories.update(id, { deletedAt: ctx.now, updatedAt: ctx.now });
        await record(ctx, { kind: "category", id }, "deleted", {});
      });
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;

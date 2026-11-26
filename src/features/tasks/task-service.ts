import type { SqlExecutor } from "@/db/executor";
import { createRepositories, type Repositories } from "@/db/repositories";
import type { CompletionEvent, StatusInterval } from "@/db/repositories/history-repository";
import type { TaskColumns } from "@/db/repositories/task-repository";
import type { ActivityEventType, ActivityPayload } from "@/domain/activity";
import { summarizeStatusDurations, type StatusDurationSummary } from "@/domain/durations";
import {
  createTaskSchema,
  statusEventType,
  TASK_STATUSES,
  updateTaskSchema,
  type CreateTaskInput,
  type Task,
  type TaskListItem,
  type TaskStatus,
  type UpdateTaskPatch,
} from "@/domain/task";
import type { TaskFilter } from "@/domain/task-filter";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { nowIso, toLocalDate, type Clock, type IsoInstant } from "@/lib/time";
import { parseOrThrow } from "@/lib/validation";
import { stopActiveForTasks } from "@/features/time-tracking/timer-core";
import { addDays } from "date-fns";
import { parseLocalDate } from "@/lib/format";

interface Ctx {
  r: Repositories;
  now: IsoInstant;
  groupId: string;
}

async function record<T extends ActivityEventType>(
  ctx: Ctx,
  taskId: string,
  eventType: T,
  payload: ActivityPayload<T>,
): Promise<void> {
  await ctx.r.activity.insert({
    id: newId(),
    subject: { kind: "task", id: taskId },
    eventType,
    payload,
    groupId: ctx.groupId,
    occurredAt: ctx.now,
  });
}

async function requireTask(r: Repositories, id: string): Promise<Task> {
  const task = await r.tasks.get(id);
  if (!task) throw new NotFoundError("Task", id);
  return task;
}

async function projectRef(r: Repositories, id: string | null) {
  if (id === null) return null;
  const project = await r.projects.get(id);
  if (!project) throw new ValidationError("That project no longer exists");
  return { id: project.id, name: project.name };
}

async function categoryRef(r: Repositories, id: string | null) {
  if (id === null) return null;
  const category = await r.categories.get(id);
  if (!category) throw new ValidationError("That category no longer exists");
  return { id: category.id, name: category.name };
}

export interface TaskDetails {
  task: TaskListItem;
  parent: Task | null;
  subtasks: TaskListItem[];
  completions: CompletionEvent[];
  intervals: StatusInterval[];
  statusDurations: StatusDurationSummary;
}

/**
 * Task use cases. Every write runs in one transaction together with the history it produces:
 * activity events, status intervals and completion records (docs/database.md §6).
 */
export function createTaskService(db: SqlExecutor, clock: Clock) {
  const read = createRepositories(db);

  function write<T>(work: (ctx: Ctx) => Promise<T>): Promise<T> {
    return db.transaction((tx) =>
      work({ r: createRepositories(tx), now: nowIso(clock), groupId: newId() }),
    );
  }

  /** Moves a task to a new status, maintaining intervals and completion records. */
  async function applyStatus(ctx: Ctx, task: Task, to: TaskStatus, undo: boolean): Promise<void> {
    const from = task.status;
    if (from === to) return;
    const { r, now } = ctx;

    await r.history.closeOpenInterval(task.id, now);
    await r.history.openInterval(newId(), task.id, to, now);
    if (from === "completed") await r.history.markReopened(task.id, now);
    if (to === "completed") {
      await r.history.insertCompletion({
        id: newId(),
        taskId: task.id,
        completedAt: now,
        completedOn: toLocalDate(new Date(now)),
        reopenedAt: null,
      });
    }
    await r.tasks.update(task.id, {
      status: to,
      statusChangedAt: now,
      completedAt: to === "completed" ? now : null,
      updatedAt: now,
    });
    await record(ctx, task.id, statusEventType(from, to), undo ? { from, to, undo } : { from, to });
    // A finished task can't keep a work timer running.
    if (to === "completed" || to === "cancelled") {
      await stopActiveForTasks(r, [task.id], now, "task_closed", ctx.groupId);
    }
  }

  async function setProject(ctx: Ctx, task: Task, projectId: string | null): Promise<void> {
    if (task.projectId === projectId) return;
    const [from, to] = await Promise.all([
      task.projectId ? ctx.r.projects.get(task.projectId, { includeDeleted: true }) : null,
      projectRef(ctx.r, projectId),
    ]);
    await ctx.r.tasks.update(task.id, { projectId, updatedAt: ctx.now });
    await record(ctx, task.id, "project_changed", {
      from: from ? { id: from.id, name: from.name } : null,
      to,
    });
  }

  const service = {
    // ---------------- reads ----------------

    list(filter: TaskFilter = {}): Promise<TaskListItem[]> {
      return read.tasks.list(filter);
    },

    get(id: string): Promise<Task | null> {
      return read.tasks.get(id);
    },

    /** Tasks for the Timeline: due or completed within [from, to] (local dates), or in progress. */
    listTimeline(from: string, to: string): Promise<TaskListItem[]> {
      return read.tasks.listInWindow({
        fromDate: from,
        toDate: to,
        fromInstant: parseLocalDate(from).toISOString(),
        toInstant: addDays(parseLocalDate(to), 1).toISOString(),
      });
    },

    async getDetails(id: string): Promise<TaskDetails | null> {
      const task = await read.tasks.getListItem(id);
      if (!task) return null;
      const [parent, subtasks, completions, intervals] = await Promise.all([
        task.parentId ? read.tasks.get(task.parentId) : null,
        read.tasks.list({
          parentId: id,
          includeArchived: true,
          sort: { field: "manual", direction: "asc" },
        }),
        read.history.listCompletions(id),
        read.history.listIntervals(id),
      ]);
      return {
        task,
        parent,
        subtasks,
        completions,
        intervals,
        statusDurations: summarizeStatusDurations(intervals, clock.now()),
      };
    },

    // ---------------- writes ----------------

    async create(input: CreateTaskInput): Promise<Task> {
      const data = parseOrThrow(createTaskSchema, input);
      return await write(async (ctx) => {
        const { r, now } = ctx;
        let projectId = data.projectId;
        let parent: Task | null = null;

        if (data.parentId) {
          parent = await requireTask(r, data.parentId);
          if (parent.parentId)
            throw new ValidationError("Subtasks can't have subtasks of their own");
          projectId = parent.projectId; // subtasks always live in their parent's project
        }
        await projectRef(r, projectId);
        await categoryRef(r, data.categoryId);

        const task: Task = {
          id: newId(),
          parentId: data.parentId,
          projectId,
          categoryId: data.categoryId,
          title: data.title,
          description: data.description,
          notes: data.notes,
          status: data.status,
          priority: data.priority,
          dueDate: data.dueDate,
          dueTime: data.dueTime,
          remindAt: null,
          sortOrder: (await r.tasks.maxSortOrder(data.parentId)) + 1,
          statusChangedAt: now,
          completedAt: data.status === "completed" ? now : null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        await r.tasks.insert(task);
        await r.history.openInterval(newId(), task.id, task.status, now);
        if (task.status === "completed") {
          await r.history.insertCompletion({
            id: newId(),
            taskId: task.id,
            completedAt: now,
            completedOn: toLocalDate(new Date(now)),
            reopenedAt: null,
          });
        }
        await record(ctx, task.id, "created", { title: task.title, parentId: task.parentId });
        if (parent)
          await record(ctx, parent.id, "subtask_added", { subtaskId: task.id, title: task.title });
        return task;
      });
    },

    /** Edits fields and records one event per changed field (sharing a group id). */
    async update(id: string, patch: UpdateTaskPatch): Promise<Task> {
      const data = parseOrThrow(updateTaskSchema, patch);
      return await write(async (ctx) => {
        const { r, now } = ctx;
        const task = await requireTask(r, id);
        const columns: TaskColumns = {};

        for (const field of ["title", "description", "notes"] as const) {
          const next = data[field];
          if (next !== undefined && next !== task[field]) {
            columns[field] = next;
            await record(ctx, id, "field_changed", { field, from: task[field], to: next });
          }
        }

        if (data.priority !== undefined && data.priority !== task.priority) {
          columns.priority = data.priority;
          await record(ctx, id, "priority_changed", { from: task.priority, to: data.priority });
        }

        if (data.dueDate !== undefined || data.dueTime !== undefined) {
          const dueDate = data.dueDate !== undefined ? data.dueDate : task.dueDate;
          // Clearing the date clears the time too.
          const dueTime =
            dueDate === null ? null : data.dueTime !== undefined ? data.dueTime : task.dueTime;
          if (dueTime !== null && dueDate === null)
            throw new ValidationError("A due time needs a due date");
          if (dueDate !== task.dueDate || dueTime !== task.dueTime) {
            columns.dueDate = dueDate;
            columns.dueTime = dueTime;
            await record(ctx, id, "due_changed", {
              fromDate: task.dueDate,
              fromTime: task.dueTime,
              toDate: dueDate,
              toTime: dueTime,
            });
          }
        }

        if (data.categoryId !== undefined && data.categoryId !== task.categoryId) {
          const [from, to] = await Promise.all([
            task.categoryId ? r.categories.get(task.categoryId, { includeDeleted: true }) : null,
            categoryRef(r, data.categoryId),
          ]);
          columns.categoryId = data.categoryId;
          await record(ctx, id, "category_changed", {
            from: from ? { id: from.id, name: from.name } : null,
            to,
          });
        }

        if (Object.keys(columns).length > 0) {
          await r.tasks.update(id, { ...columns, updatedAt: now });
        }

        if (data.projectId !== undefined && data.projectId !== task.projectId) {
          if (task.parentId)
            throw new ValidationError("Subtasks follow their parent task's project");
          await setProject(ctx, task, data.projectId);
          for (const child of await r.tasks.listChildren(id))
            await setProject(ctx, child, data.projectId);
        }

        return requireTask(r, id);
      });
    },

    async setStatus(
      id: string,
      status: TaskStatus,
      options: { undo?: boolean } = {},
    ): Promise<Task> {
      if (!TASK_STATUSES.includes(status)) throw new ValidationError(`Unknown status: ${status}`);
      return await write(async (ctx) => {
        const task = await requireTask(ctx.r, id);
        await applyStatus(ctx, task, status, options.undo ?? false);
        return requireTask(ctx.r, id);
      });
    },

    /**
     * Board drop. `orderedIds` is the target column's final order including the moved task.
     * The task gets a sort order between its new neighbours (one row written); when the
     * fractional gap is exhausted the column is renumbered. A column change is a real status
     * change, with intervals, completion records and an activity event.
     */
    async move(
      id: string,
      target: { status: TaskStatus; orderedIds: readonly string[] },
    ): Promise<Task> {
      const index = target.orderedIds.indexOf(id);
      if (index < 0) throw new ValidationError("The moved task must be part of the target order");
      if (!TASK_STATUSES.includes(target.status)) throw new ValidationError("Unknown status");
      return await write(async (ctx) => {
        const task = await requireTask(ctx.r, id);
        const beforeId = target.orderedIds[index - 1];
        const afterId = target.orderedIds[index + 1];
        const orders = await ctx.r.tasks.sortOrders(
          [beforeId, afterId].filter((x): x is string => !!x),
        );
        const before = beforeId ? orders.get(beforeId) : undefined;
        const after = afterId ? orders.get(afterId) : undefined;

        let sortOrder: number | null;
        if (before !== undefined && after !== undefined) {
          sortOrder = after - before > 1e-6 ? (before + after) / 2 : null;
        } else if (before !== undefined) sortOrder = before + 1;
        else if (after !== undefined) sortOrder = after - 1;
        else sortOrder = task.sortOrder;

        if (sortOrder === null) await ctx.r.tasks.renumber(target.orderedIds);
        else if (sortOrder !== task.sortOrder)
          await ctx.r.tasks.update(id, { sortOrder, updatedAt: ctx.now });

        await applyStatus(ctx, task, target.status, false);
        return requireTask(ctx.r, id);
      });
    },

    addSubtask(parentId: string, title: string): Promise<Task> {
      return service.create({ parentId, title });
    },

    archive(id: string): Promise<Task> {
      return write(async (ctx) => {
        const task = await requireTask(ctx.r, id);
        if (task.archivedAt) return task;
        await ctx.r.tasks.update(id, { archivedAt: ctx.now, updatedAt: ctx.now });
        await record(ctx, id, "archived", {});
        return requireTask(ctx.r, id);
      });
    },

    /**
     * Archives completed top-level tasks (optionally only those completed before a moment).
     * Returns the ids so the caller can offer undo. History and completions are untouched.
     */
    async archiveCompleted(options: { completedBefore?: IsoInstant } = {}): Promise<string[]> {
      return await write(async (ctx) => {
        const done = await ctx.r.tasks.list({
          statuses: ["completed"],
          ...(options.completedBefore ? { completed: { to: options.completedBefore } } : {}),
        });
        for (const task of done) {
          await ctx.r.tasks.update(task.id, { archivedAt: ctx.now, updatedAt: ctx.now });
          await record(ctx, task.id, "archived", {});
        }
        return done.map((t) => t.id);
      });
    },

    async unarchiveMany(ids: readonly string[]): Promise<void> {
      await write(async (ctx) => {
        for (const id of ids) {
          const task = await ctx.r.tasks.get(id);
          if (!task?.archivedAt) continue;
          await ctx.r.tasks.update(id, { archivedAt: null, updatedAt: ctx.now });
          await record(ctx, id, "unarchived", {});
        }
      });
    },

    unarchive(id: string): Promise<Task> {
      return write(async (ctx) => {
        const task = await requireTask(ctx.r, id);
        if (!task.archivedAt) return task;
        await ctx.r.tasks.update(id, { archivedAt: null, updatedAt: ctx.now });
        await record(ctx, id, "unarchived", {});
        return requireTask(ctx.r, id);
      });
    },

    /** Soft delete (task and its subtasks). History is kept; `restore` brings everything back. */
    delete(id: string): Promise<void> {
      return write(async (ctx) => {
        const { r, now } = ctx;
        const task = await requireTask(r, id);
        const children = await r.tasks.listChildren(id);
        await stopActiveForTasks(
          r,
          [id, ...children.map((c) => c.id)],
          now,
          "task_deleted",
          ctx.groupId,
        );
        for (const child of children) {
          await r.tasks.update(child.id, { deletedAt: now, updatedAt: now });
          await record(ctx, child.id, "deleted", {});
        }
        await r.tasks.update(id, { deletedAt: now, updatedAt: now });
        await record(ctx, id, "deleted", {});
        if (task.parentId) {
          await record(ctx, task.parentId, "subtask_removed", { subtaskId: id, title: task.title });
        }
      });
    },

    restore(id: string): Promise<Task> {
      return write(async (ctx) => {
        const { r, now } = ctx;
        const task = await r.tasks.get(id, { includeDeleted: true });
        if (!task) throw new NotFoundError("Task", id);
        if (!task.deletedAt) return task;
        if (task.parentId && !(await r.tasks.get(task.parentId))) {
          throw new ValidationError("Restore the parent task first");
        }
        // Bring back the subtasks that were deleted together with this task.
        for (const child of await r.tasks.listChildren(id, { includeDeleted: true })) {
          if (child.deletedAt === task.deletedAt) {
            await r.tasks.update(child.id, { deletedAt: null, updatedAt: now });
            await record(ctx, child.id, "restored", {});
          }
        }
        await r.tasks.update(id, { deletedAt: null, updatedAt: now });
        await record(ctx, id, "restored", {});
        if (task.parentId) {
          await record(ctx, task.parentId, "subtask_added", { subtaskId: id, title: task.title });
        }
        return requireTask(r, id);
      });
    },
  };
  return service;
}

export type TaskService = ReturnType<typeof createTaskService>;

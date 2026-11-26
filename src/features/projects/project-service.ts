import type { SqlExecutor } from "@/db/executor";
import { createRepositories, type Repositories } from "@/db/repositories";
import type { ProjectColumns } from "@/db/repositories/project-repository";
import type { ActivityEventType, ActivityPayload } from "@/domain/activity";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type Project,
  type ProjectWithProgress,
  type UpdateProjectPatch,
} from "@/domain/project";
import { NotFoundError } from "@/lib/errors";
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
  subject: { kind: "task" | "project"; id: string },
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

async function requireProject(r: Repositories, id: string): Promise<Project> {
  const project = await r.projects.get(id);
  if (!project) throw new NotFoundError("Project", id);
  return project;
}

export function createProjectService(db: SqlExecutor, clock: Clock) {
  const read = createRepositories(db);
  const write = <T>(work: (ctx: Ctx) => Promise<T>) =>
    db.transaction((tx) =>
      work({ r: createRepositories(tx), now: nowIso(clock), groupId: newId() }),
    );

  return {
    list: (options: { includeArchived?: boolean } = {}): Promise<ProjectWithProgress[]> =>
      read.projects.list(options),
    get: (id: string): Promise<ProjectWithProgress | null> => read.projects.getWithProgress(id),

    async create(input: CreateProjectInput): Promise<Project> {
      const data = parseOrThrow(createProjectSchema, input);
      return await write(async (ctx) => {
        const project: Project = {
          id: newId(),
          name: data.name,
          description: data.description,
          color: data.color,
          sortOrder: (await ctx.r.projects.maxSortOrder()) + 1,
          archivedAt: null,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          deletedAt: null,
        };
        await ctx.r.projects.insert(project);
        await record(ctx, { kind: "project", id: project.id }, "created", {
          title: project.name,
          parentId: null,
        });
        return project;
      });
    },

    async update(id: string, patch: UpdateProjectPatch): Promise<Project> {
      const data = parseOrThrow(updateProjectSchema, patch);
      return await write(async (ctx) => {
        const project = await requireProject(ctx.r, id);
        const columns: ProjectColumns = {};
        for (const field of ["name", "description", "color"] as const) {
          const next = data[field];
          if (next !== undefined && next !== project[field]) {
            columns[field] = next as never;
            await record(ctx, { kind: "project", id }, "field_changed", {
              field,
              from: project[field],
              to: next,
            });
          }
        }
        if (Object.keys(columns).length > 0)
          await ctx.r.projects.update(id, { ...columns, updatedAt: ctx.now });
        return requireProject(ctx.r, id);
      });
    },

    /** Archived projects leave the active lists but keep all tasks and history. */
    archive(id: string): Promise<Project> {
      return write(async (ctx) => {
        const project = await requireProject(ctx.r, id);
        if (project.archivedAt) return project;
        await ctx.r.projects.update(id, { archivedAt: ctx.now, updatedAt: ctx.now });
        await record(ctx, { kind: "project", id }, "archived", {});
        return requireProject(ctx.r, id);
      });
    },

    unarchive(id: string): Promise<Project> {
      return write(async (ctx) => {
        const project = await requireProject(ctx.r, id);
        if (!project.archivedAt) return project;
        await ctx.r.projects.update(id, { archivedAt: null, updatedAt: ctx.now });
        await record(ctx, { kind: "project", id }, "unarchived", {});
        return requireProject(ctx.r, id);
      });
    },

    /**
     * Soft-deletes the project. Its tasks are kept and become standalone; each one records a
     * `project_changed` event so its own history explains what happened.
     */
    delete(id: string): Promise<void> {
      return write(async (ctx) => {
        const project = await requireProject(ctx.r, id);
        const tasks = await ctx.r.tasks.list({
          projectIds: [id],
          anyLevel: true,
          includeArchived: true,
        });
        for (const task of tasks) {
          await ctx.r.tasks.update(task.id, { projectId: null, updatedAt: ctx.now });
          await record(ctx, { kind: "task", id: task.id }, "project_changed", {
            from: { id: project.id, name: project.name },
            to: null,
          });
        }
        await ctx.r.projects.update(id, { deletedAt: ctx.now, updatedAt: ctx.now });
        await record(ctx, { kind: "project", id }, "deleted", {});
      });
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;

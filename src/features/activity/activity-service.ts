import type { SqlExecutor } from "@/db/executor";
import { createRepositories } from "@/db/repositories";
import type { FeedCursor } from "@/db/repositories/activity-repository";
import {
  noteBodySchema,
  type ActivityEvent,
  type ActivityFeedItem,
  type ActivitySource,
} from "@/domain/activity";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { nowIso, type Clock } from "@/lib/time";
import { parseOrThrow } from "@/lib/validation";

export const FEED_PAGE_SIZE = 50;

/** Reading timelines and writing user notes. System events are written by the other services. */
export function createActivityService(db: SqlExecutor, clock: Clock) {
  const read = createRepositories(db);

  return {
    listForTask: (taskId: string): Promise<ActivityEvent[]> => read.activity.listForTask(taskId),
    listForProject: (projectId: string): Promise<ActivityEvent[]> =>
      read.activity.listForProject(projectId),

    feed(
      options: { before?: FeedCursor; source?: ActivitySource } = {},
    ): Promise<ActivityFeedItem[]> {
      return read.activity.listFeed({ ...options, limit: FEED_PAGE_SIZE });
    },

    /** Adds a manual note to a task's timeline. Notes are marked `source = 'user'`. */
    async addNote(taskId: string, body: string): Promise<string> {
      const text = parseOrThrow(noteBodySchema, body);
      return await db.transaction(async (tx) => {
        const r = createRepositories(tx);
        if (!(await r.tasks.get(taskId))) throw new NotFoundError("Task", taskId);
        const id = newId();
        await r.activity.insert({
          id,
          subject: { kind: "task", id: taskId },
          eventType: "note",
          payload: {},
          body: text,
          occurredAt: nowIso(clock),
        });
        return id;
      });
    },

    /** Edits a note's text and stamps `edited_at`. System events can never be edited. */
    async editNote(noteId: string, body: string): Promise<void> {
      const text = parseOrThrow(noteBodySchema, body);
      await db.transaction(async (tx) => {
        const r = createRepositories(tx);
        const event = await r.activity.get(noteId);
        if (!event) throw new NotFoundError("Note", noteId);
        if (event.eventType !== "note") throw new ValidationError("Only notes can be edited");
        if (event.body === text) return;
        await r.activity.updateNoteBody(noteId, text, nowIso(clock));
      });
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;

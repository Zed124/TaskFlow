import {
  activityPayloadSchemas,
  isActivityEventType,
  type ActivityEvent,
  type ActivityEventType,
  type ActivityFeedItem,
  type ActivityPayload,
  type ActivitySource,
  type ActivitySubject,
} from "@/domain/activity";
import type { IsoInstant } from "@/lib/time";
import type { SqlExecutor, SqlValue } from "../executor";

type ActivityRow = {
  id: string;
  task_id: string | null;
  project_id: string | null;
  category_id: string | null;
  event_type: string;
  source: ActivitySource;
  body: string | null;
  payload: string;
  group_id: string | null;
  occurred_at: string;
  edited_at: string | null;
};

type FeedRow = ActivityRow & {
  task_title: string | null;
  project_name: string | null;
  category_name: string | null;
};

export interface NewActivityEvent<T extends ActivityEventType> {
  id: string;
  subject: ActivitySubject;
  eventType: T;
  payload: ActivityPayload<T>;
  body?: string | null;
  groupId?: string | null;
  occurredAt: IsoInstant;
}

const COLUMNS = `a.id, a.task_id, a.project_id, a.category_id, a.event_type, a.source, a.body,
  a.payload, a.group_id, a.occurred_at, a.edited_at`;

function mapEvent(r: ActivityRow): ActivityEvent {
  const base = {
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    categoryId: r.category_id,
    source: r.source,
    body: r.body,
    groupId: r.group_id,
    occurredAt: r.occurred_at as IsoInstant,
    editedAt: r.edited_at as IsoInstant | null,
  };
  if (isActivityEventType(r.event_type)) {
    const parsed = activityPayloadSchemas[r.event_type].safeParse(JSON.parse(r.payload));
    if (parsed.success) {
      // The schema lookup is keyed by the same event type, so this pairing is sound.
      return { ...base, eventType: r.event_type, payload: parsed.data } as ActivityEvent;
    }
  }
  // Unknown or malformed (e.g. written by a newer version): keep it visible, but untyped.
  return { ...base, eventType: "unknown", rawType: r.event_type, payload: {} };
}

export interface FeedCursor {
  occurredAt: IsoInstant;
  id: string;
}

export function createActivityRepository(db: SqlExecutor) {
  return {
    async insert<T extends ActivityEventType>(event: NewActivityEvent<T>): Promise<void> {
      // Validate before writing: history must never contain malformed payloads.
      const payload = activityPayloadSchemas[event.eventType].parse(event.payload);
      const source: ActivitySource = event.eventType === "note" ? "user" : "system";
      const { subject } = event;
      await db.execute(
        `INSERT INTO activity_events (id, task_id, project_id, category_id, event_type, source, body,
           payload, group_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          subject.kind === "task" ? subject.id : null,
          subject.kind === "project" ? subject.id : null,
          subject.kind === "category" ? subject.id : null,
          event.eventType,
          source,
          event.body ?? null,
          JSON.stringify(payload),
          event.groupId ?? null,
          event.occurredAt,
        ],
      );
    },

    async get(id: string): Promise<ActivityEvent | null> {
      const rows = await db.select<ActivityRow>(
        `SELECT ${COLUMNS} FROM activity_events a WHERE a.id = ?`,
        [id],
      );
      return rows[0] ? mapEvent(rows[0]) : null;
    },

    /** Oldest first, like a conversation. */
    async listForTask(taskId: string): Promise<ActivityEvent[]> {
      const rows = await db.select<ActivityRow>(
        `SELECT ${COLUMNS} FROM activity_events a WHERE a.task_id = ? ORDER BY a.occurred_at, a.rowid`,
        [taskId],
      );
      return rows.map(mapEvent);
    },

    async listForProject(projectId: string): Promise<ActivityEvent[]> {
      const rows = await db.select<ActivityRow>(
        `SELECT ${COLUMNS} FROM activity_events a WHERE a.project_id = ? ORDER BY a.occurred_at, a.rowid`,
        [projectId],
      );
      return rows.map(mapEvent);
    },

    /** Newest first, keyset-paginated (stable under inserts, unlike OFFSET). */
    async listFeed(options: {
      before?: FeedCursor;
      limit: number;
      source?: ActivitySource;
    }): Promise<ActivityFeedItem[]> {
      const clauses: string[] = [];
      const params: SqlValue[] = [];
      if (options.before) {
        clauses.push("(a.occurred_at < ? OR (a.occurred_at = ? AND a.id < ?))");
        params.push(options.before.occurredAt, options.before.occurredAt, options.before.id);
      }
      if (options.source) {
        clauses.push("a.source = ?");
        params.push(options.source);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await db.select<FeedRow>(
        `SELECT ${COLUMNS}, t.title AS task_title, p.name AS project_name, c.name AS category_name
         FROM activity_events a
         LEFT JOIN tasks t ON t.id = a.task_id
         LEFT JOIN projects p ON p.id = a.project_id
         LEFT JOIN categories c ON c.id = a.category_id
         ${where}
         ORDER BY a.occurred_at DESC, a.id DESC
         LIMIT ?`,
        [...params, options.limit],
      );
      return rows.map((r) => ({
        ...mapEvent(r),
        taskTitle: r.task_title,
        projectName: r.project_name,
        categoryName: r.category_name,
      }));
    },

    async updateNoteBody(id: string, body: string, at: IsoInstant): Promise<void> {
      await db.execute(
        "UPDATE activity_events SET body = ?, edited_at = ? WHERE id = ? AND event_type = 'note'",
        [body, at, id],
      );
    },
  };
}

export type ActivityRepository = ReturnType<typeof createActivityRepository>;

import { z } from "zod";
import type { IsoInstant } from "@/lib/time";
import { TASK_PRIORITIES, TASK_STATUSES } from "./task";

const status = z.enum(TASK_STATUSES);
const priority = z.enum(TASK_PRIORITIES);
const ref = z.object({ id: z.string(), name: z.string() });
const nothing = z.object({}).strict();

const statusChange = z.object({ from: status, to: status, undo: z.boolean().optional() });

/**
 * Payload schema per event type. Every payload is validated before it is written, and
 * parsed again when read. See docs/database.md §5.
 */
export const activityPayloadSchemas = {
  created: z.object({ title: z.string(), parentId: z.string().nullable() }),
  field_changed: z.object({
    field: z.enum(["title", "description", "notes", "name", "color"]),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  status_changed: statusChange,
  completed: statusChange,
  cancelled: statusChange,
  reopened: statusChange,
  priority_changed: z.object({ from: priority, to: priority }),
  due_changed: z.object({
    fromDate: z.string().nullable(),
    fromTime: z.string().nullable(),
    toDate: z.string().nullable(),
    toTime: z.string().nullable(),
  }),
  project_changed: z.object({ from: ref.nullable(), to: ref.nullable() }),
  category_changed: z.object({ from: ref.nullable(), to: ref.nullable() }),
  subtask_added: z.object({ subtaskId: z.string(), title: z.string() }),
  subtask_removed: z.object({ subtaskId: z.string(), title: z.string() }),
  archived: nothing,
  unarchived: nothing,
  deleted: nothing,
  restored: nothing,
  note: nothing,
} as const;

export type ActivityEventType = keyof typeof activityPayloadSchemas;
export type ActivityPayload<T extends ActivityEventType> = z.infer<
  (typeof activityPayloadSchemas)[T]
>;
export type ActivitySource = "system" | "user";
export type ActivitySubject =
  { kind: "task"; id: string } | { kind: "project"; id: string } | { kind: "category"; id: string };

export function isActivityEventType(value: string): value is ActivityEventType {
  return Object.hasOwn(activityPayloadSchemas, value);
}

interface ActivityEventBase {
  id: string;
  taskId: string | null;
  projectId: string | null;
  categoryId: string | null;
  source: ActivitySource;
  body: string | null;
  groupId: string | null;
  occurredAt: IsoInstant;
  editedAt: IsoInstant | null;
}

/** Discriminated union: `switch (event.eventType)` narrows `payload`. */
export type ActivityEvent =
  | {
      [K in ActivityEventType]: ActivityEventBase & { eventType: K; payload: ActivityPayload<K> };
    }[ActivityEventType]
  | (ActivityEventBase & { eventType: "unknown"; rawType: string; payload: Record<string, never> });

/** Activity row enriched with the names needed by the global feed. */
export type ActivityFeedItem = ActivityEvent & {
  taskTitle: string | null;
  projectName: string | null;
  categoryName: string | null;
};

export const NOTE_MAX = 20_000;
export const noteBodySchema = z
  .string()
  .trim()
  .min(1, "Write something first")
  .max(NOTE_MAX, "Note is too long");

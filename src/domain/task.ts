import { z } from "zod";
import { isLocalDate, type IsoInstant, type LocalDate } from "@/lib/time";

export const TASK_STATUSES = ["todo", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Higher = more important. Used for sorting. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export const TITLE_MAX = 500;
export const TEXT_MAX = 100_000;

export interface Task {
  id: string;
  parentId: string | null;
  projectId: string | null;
  categoryId: string | null;
  title: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: LocalDate | null;
  dueTime: string | null;
  remindAt: IsoInstant | null;
  sortOrder: number;
  statusChangedAt: IsoInstant;
  completedAt: IsoInstant | null;
  archivedAt: IsoInstant | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  deletedAt: IsoInstant | null;
}

/** A task as shown in lists: includes counts and names needed for display. */
export interface TaskListItem extends Task {
  projectName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
}

export function isOpenStatus(status: TaskStatus): boolean {
  return status === "todo" || status === "in_progress";
}

export function isClosedStatus(status: TaskStatus): boolean {
  return !isOpenStatus(status);
}

/**
 * Which activity event a status change produces. Every change is allowed; the event type
 * records its meaning (e.g. leaving Completed is a reopen, regardless of the target status).
 */
export function statusEventType(
  from: TaskStatus,
  to: TaskStatus,
): "completed" | "cancelled" | "reopened" | "status_changed" {
  if (to === "completed") return "completed";
  if (to === "cancelled") return "cancelled";
  if (from === "completed" || from === "cancelled") return "reopened";
  return "status_changed";
}

// ---------- input validation ----------

const title = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(TITLE_MAX, `Title must be at most ${TITLE_MAX} characters`);
const longText = z.string().max(TEXT_MAX, "Text is too long");
const localDate = z.string().refine(isLocalDate, "Use a valid date (YYYY-MM-DD)");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time (HH:mm)");
const id = z.string().min(1);

export const createTaskSchema = z
  .object({
    title,
    description: longText.default(""),
    notes: longText.default(""),
    status: z.enum(TASK_STATUSES).default("todo"),
    priority: z.enum(TASK_PRIORITIES).default("medium"),
    dueDate: localDate.nullable().default(null),
    dueTime: timeOfDay.nullable().default(null),
    projectId: id.nullable().default(null),
    categoryId: id.nullable().default(null),
    parentId: id.nullable().default(null),
  })
  .refine((v) => v.dueTime === null || v.dueDate !== null, {
    error: "A due time needs a due date",
    path: ["dueTime"],
  });

export type CreateTaskInput = z.input<typeof createTaskSchema>;

/** Fields editable through `TaskService.update`. Status has its own use case. */
export const updateTaskSchema = z
  .object({
    title,
    description: longText,
    notes: longText,
    priority: z.enum(TASK_PRIORITIES),
    dueDate: localDate.nullable(),
    dueTime: timeOfDay.nullable(),
    projectId: id.nullable(),
    categoryId: id.nullable(),
  })
  .partial();

export type UpdateTaskPatch = z.input<typeof updateTaskSchema>;

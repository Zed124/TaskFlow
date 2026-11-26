import { createElement } from "react";
import {
  Archive,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  History,
  ListTree,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Signal,
  Tag,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent } from "@/domain/activity";

const ICONS: Partial<Record<ActivityEvent["eventType"], LucideIcon>> = {
  created: Plus,
  field_changed: Pencil,
  status_changed: CircleDot,
  completed: CheckCircle2,
  cancelled: XCircle,
  reopened: RotateCcw,
  priority_changed: Signal,
  due_changed: CalendarDays,
  project_changed: ArrowRightLeft,
  category_changed: Tag,
  subtask_added: ListTree,
  subtask_removed: ListTree,
  archived: Archive,
  unarchived: Archive,
  deleted: Trash2,
  restored: RotateCcw,
  note: MessageSquareText,
};

/** The glyph for an activity event type (static icon components, chosen by lookup). */
export function EventIcon({
  type,
  className,
}: {
  type: ActivityEvent["eventType"];
  className?: string;
}) {
  return createElement(ICONS[type] ?? History, {
    className,
    strokeWidth: 1.75,
    "aria-hidden": true,
  });
}

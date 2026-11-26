import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityEvent } from "@/domain/activity";
import { formatDuration, formatLocalDate } from "@/lib/format";

/** Turns an activity event into a short sentence ("changed priority from Low to High"). */
export function useDescribeEvent(): (event: ActivityEvent) => string {
  const { t } = useTranslation();

  return useCallback(
    (event: ActivityEvent): string => {
      const due = (date: string | null, time: string | null) =>
        date ? `${formatLocalDate(date)}${time ? ` ${time}` : ""}` : "";
      const undo = (e: { payload: { undo?: boolean } }) =>
        e.payload.undo ? ` ${t("activity.events.undo")}` : "";

      switch (event.eventType) {
        case "created":
          return event.payload.parentId
            ? t("activity.events.createdSubtask")
            : t("activity.events.created");
        case "field_changed":
          if (event.payload.field === "title" || event.payload.field === "name") {
            return t("activity.events.field_changed_title", {
              from: event.payload.from ?? "",
              to: event.payload.to ?? "",
            });
          }
          return t("activity.events.field_changed", {
            field: t(`activity.fields.${event.payload.field}`),
          });
        case "status_changed":
          return (
            t("activity.events.status_changed", {
              from: t(`status.${event.payload.from}`),
              to: t(`status.${event.payload.to}`),
            }) + undo(event)
          );
        case "completed":
          return t("activity.events.completed") + undo(event);
        case "cancelled":
          return t("activity.events.cancelled") + undo(event);
        case "reopened":
          return (
            t("activity.events.reopened", {
              from: t(`status.${event.payload.from}`),
              to: t(`status.${event.payload.to}`),
            }) + undo(event)
          );
        case "priority_changed":
          return t("activity.events.priority_changed", {
            from: t(`priority.${event.payload.from}`),
            to: t(`priority.${event.payload.to}`),
          });
        case "due_changed": {
          const { fromDate, fromTime, toDate, toTime } = event.payload;
          if (!toDate) return t("activity.events.due_cleared");
          if (!fromDate) return t("activity.events.due_set", { to: due(toDate, toTime) });
          return t("activity.events.due_changed", {
            from: due(fromDate, fromTime),
            to: due(toDate, toTime),
          });
        }
        case "project_changed": {
          const { from, to } = event.payload;
          if (!to) return t("activity.events.project_cleared", { from: from?.name ?? "" });
          if (!from) return t("activity.events.project_set", { to: to.name });
          return t("activity.events.project_changed", { from: from.name, to: to.name });
        }
        case "category_changed": {
          const { from, to } = event.payload;
          if (!to) return t("activity.events.category_cleared", { from: from?.name ?? "" });
          if (!from) return t("activity.events.category_set", { to: to.name });
          return t("activity.events.category_changed", { from: from.name, to: to.name });
        }
        case "subtask_added":
          return t("activity.events.subtask_added", { title: event.payload.title });
        case "subtask_removed":
          return t("activity.events.subtask_removed", { title: event.payload.title });
        case "archived":
        case "unarchived":
        case "deleted":
        case "restored":
          return t(`activity.events.${event.eventType}`);
        case "note":
          return event.body ?? "";
        case "work_session_logged":
          return t(`activity.events.work_session_logged_${event.payload.reason}`, {
            duration: formatDuration(event.payload.durationMs),
          });
        case "unknown":
          return t("activity.events.unknown", { type: event.rawType });
      }
    },
    [t],
  );
}

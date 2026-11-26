import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { describeDue, type DueTone } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TaskStatus } from "@/domain/task";

const TONE: Record<DueTone, string> = {
  overdue: "text-danger",
  today: "text-warning",
  soon: "text-fg-muted",
  later: "text-fg-subtle",
  none: "text-fg-subtle",
};

/** Due date with urgency coloring. Closed tasks are never shown as overdue. */
export function DueLabel({
  dueDate,
  dueTime,
  status,
  className,
}: {
  dueDate: string | null;
  dueTime: string | null;
  status: TaskStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!dueDate) return null;
  const label = describeDue(dueDate, dueTime, new Date(), {
    today: t("due.today"),
    tomorrow: t("due.tomorrow"),
    yesterday: t("due.yesterday"),
    none: t("due.none"),
  });
  const closed = status === "completed" || status === "cancelled";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
        closed ? "text-fg-subtle" : TONE[label.tone],
        className,
      )}
      title={label.tone === "overdue" && !closed ? t("due.overdue") : undefined}
    >
      <CalendarDays className="size-3.5" strokeWidth={1.75} aria-hidden />
      {label.text}
    </span>
  );
}

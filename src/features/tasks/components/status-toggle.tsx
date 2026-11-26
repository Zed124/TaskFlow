import { useTranslation } from "react-i18next";
import type { TaskStatus } from "@/domain/task";
import { cn } from "@/lib/cn";
import { StatusIcon } from "./status-icon";

/** One-click completion: open tasks complete, closed tasks go back to To do. */
export function StatusToggle({
  status,
  onChange,
  disabled,
  className,
}: {
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const closed = status === "completed" || status === "cancelled";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={closed ? t("status.markIncomplete") : t("status.markComplete")}
      title={t(`status.${status}`)}
      onClick={(e) => {
        e.stopPropagation();
        onChange(closed ? "todo" : "completed");
      }}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-sm transition-transform duration-100 hover:scale-110 hover:bg-hover active:scale-95",
        className,
      )}
    >
      <StatusIcon status={status} />
    </button>
  );
}

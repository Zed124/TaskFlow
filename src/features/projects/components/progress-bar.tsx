import { useTranslation } from "react-i18next";
import { progressRatio, type ProjectProgress } from "@/domain/project";

/** Completed share of non-cancelled top-level tasks. */
export function ProgressBar({ progress, color }: { progress: ProjectProgress; color: string }) {
  const { t } = useTranslation();
  const ratio = progressRatio(progress);
  const label =
    progress.total === 0
      ? t("projects.noTasks")
      : t("projects.progress", { completed: progress.completed, total: progress.total });
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label={label}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised"
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="shrink-0 text-xs text-fg-subtle tabular-nums">{label}</span>
    </div>
  );
}

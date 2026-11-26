import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EMPTY, type SelectOption } from "@/components/ui/select";
import { ColorDot } from "@/components/ui/color-dot";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/domain/task";
import { useCategories } from "@/features/categories/use-categories";
import { useProjects } from "@/features/projects/use-projects";
import { PriorityIcon } from "./priority-icon";
import { StatusIcon } from "./status-icon";

export function useStatusOptions(): SelectOption[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      TASK_STATUSES.map((s) => ({
        value: s,
        label: t(`status.${s}`),
        icon: <StatusIcon status={s} />,
      })),
    [t],
  );
}

export function usePriorityOptions(): SelectOption[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      [...TASK_PRIORITIES]
        .reverse()
        .map((p) => ({ value: p, label: t(`priority.${p}`), icon: <PriorityIcon priority={p} /> })),
    [t],
  );
}

/** Active projects, plus the currently selected one even if it is archived. */
export function useProjectOptions(selectedId?: string | null): SelectOption[] {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects(true);
  return useMemo(
    () => [
      { value: EMPTY, label: t("tasks.noProject") },
      ...projects
        .filter((p) => !p.archivedAt || p.id === selectedId)
        .map((p) => ({ value: p.id, label: p.name, icon: <ColorDot color={p.color} /> })),
    ],
    [projects, selectedId, t],
  );
}

export function useCategoryOptions(): SelectOption[] {
  const { t } = useTranslation();
  const { data: categories = [] } = useCategories();
  return useMemo(
    () => [
      { value: EMPTY, label: t("tasks.noCategory") },
      ...categories.map((c) => ({
        value: c.id,
        label: c.name,
        icon: <ColorDot color={c.color} />,
      })),
    ],
    [categories, t],
  );
}

export const toOptional = (value: string): string | null => (value === EMPTY ? null : value);
export const fromOptional = (value: string | null | undefined): string => value ?? EMPTY;

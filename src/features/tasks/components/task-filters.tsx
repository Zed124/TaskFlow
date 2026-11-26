import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownUp, ChevronDown, Search, X } from "lucide-react";
import { addDays } from "date-fns";
import { cn } from "@/lib/cn";
import { toLocalDate } from "@/lib/time";
import { ColorDot } from "@/components/ui/color-dot";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/domain/task";
import { NONE, TASK_SORT_FIELDS, type TaskFilter, type TaskSortField } from "@/domain/task-filter";
import { useCategories } from "@/features/categories/use-categories";
import { useProjects } from "@/features/projects/use-projects";
import { PriorityIcon } from "./priority-icon";
import { StatusIcon } from "./status-icon";

type DuePreset = "any" | "overdue" | "today" | "next7" | "has" | "none";

function duePresetOf(filter: TaskFilter): DuePreset {
  const due = filter.due;
  if (!due) return "any";
  if (due.none === true) return "none";
  const today = toLocalDate(new Date());
  if (due.to && !due.from) return "overdue";
  if (due.from === today && due.to === today) return "today";
  if (due.from === today && due.to) return "next7";
  return "has";
}

function dueFromPreset(preset: DuePreset): TaskFilter["due"] {
  const now = new Date();
  const today = toLocalDate(now);
  switch (preset) {
    case "any":
      return undefined;
    case "overdue":
      return { to: toLocalDate(addDays(now, -1)) };
    case "today":
      return { from: today, to: today };
    case "next7":
      return { from: today, to: toLocalDate(addDays(now, 7)) };
    case "has":
      return { none: false };
    case "none":
      return { none: true };
  }
}

function toggle<T>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

interface TaskFiltersProps {
  filter: TaskFilter;
  onChange: (next: TaskFilter) => void;
  /** Hide the project filter (e.g. on a project page). */
  hideProject?: boolean;
  count?: number;
  actions?: ReactNode;
}

export function TaskFilters({ filter, onChange, hideProject, count, actions }: TaskFiltersProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects();
  const { data: categories = [] } = useCategories();
  const set = (patch: Partial<TaskFilter>) => onChange({ ...filter, ...patch });
  const sort = filter.sort ?? { field: "created" as TaskSortField, direction: "desc" as const };
  const duePreset = duePresetOf(filter);
  const hasFilters =
    !!filter.statuses?.length ||
    !!filter.priorities?.length ||
    !!filter.projectIds?.length ||
    !!filter.categoryIds?.length ||
    !!filter.due ||
    !!filter.text;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-(--tf-page-x) py-2">
      <label className="relative me-1 flex items-center">
        <Search
          className="pointer-events-none absolute start-2 size-3.5 text-fg-subtle"
          aria-hidden
        />
        <input
          value={filter.text ?? ""}
          onChange={(e) => set({ text: e.target.value })}
          placeholder={t("tasks.filter.search")}
          aria-label={t("tasks.filter.search")}
          className="h-7 w-44 rounded-sm border border-line bg-canvas ps-7 pe-2 text-xs text-fg placeholder:text-fg-subtle hover:border-line-strong focus:border-accent focus:outline-none"
        />
      </label>

      <FilterMenu label={t("tasks.filter.status")} active={filter.statuses?.length ?? 0}>
        {TASK_STATUSES.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={filter.statuses?.includes(s) ?? false}
            onCheckedChange={() => set({ statuses: toggle(filter.statuses, s) })}
          >
            <StatusIcon status={s} />
            {t(`status.${s}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      <FilterMenu label={t("tasks.filter.priority")} active={filter.priorities?.length ?? 0}>
        {[...TASK_PRIORITIES].reverse().map((p) => (
          <DropdownMenuCheckboxItem
            key={p}
            checked={filter.priorities?.includes(p) ?? false}
            onCheckedChange={() => set({ priorities: toggle(filter.priorities, p) })}
          >
            <PriorityIcon priority={p} />
            {t(`priority.${p}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      {!hideProject && (
        <FilterMenu label={t("tasks.filter.project")} active={filter.projectIds?.length ?? 0}>
          <DropdownMenuCheckboxItem
            checked={filter.projectIds?.includes(NONE) ?? false}
            onCheckedChange={() => set({ projectIds: toggle(filter.projectIds, NONE) })}
          >
            {t("tasks.noProject")}
          </DropdownMenuCheckboxItem>
          {projects.map((p) => (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={filter.projectIds?.includes(p.id) ?? false}
              onCheckedChange={() => set({ projectIds: toggle(filter.projectIds, p.id) })}
            >
              <ColorDot color={p.color} />
              <span className="truncate">{p.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </FilterMenu>
      )}

      <FilterMenu label={t("tasks.filter.category")} active={filter.categoryIds?.length ?? 0}>
        <DropdownMenuCheckboxItem
          checked={filter.categoryIds?.includes(NONE) ?? false}
          onCheckedChange={() => set({ categoryIds: toggle(filter.categoryIds, NONE) })}
        >
          {t("tasks.noCategory")}
        </DropdownMenuCheckboxItem>
        {categories.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={filter.categoryIds?.includes(c.id) ?? false}
            onCheckedChange={() => set({ categoryIds: toggle(filter.categoryIds, c.id) })}
          >
            <ColorDot color={c.color} />
            <span className="truncate">{c.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      <FilterMenu label={t("tasks.filter.due")} active={duePreset === "any" ? 0 : 1}>
        <DropdownMenuRadioGroup
          value={duePreset}
          onValueChange={(v) => set({ due: dueFromPreset(v as DuePreset) })}
        >
          {(
            [
              ["any", t("due.any")],
              ["overdue", t("due.overdueOnly")],
              ["today", t("due.today")],
              ["next7", t("due.next7")],
              ["has", t("due.hasDate")],
              ["none", t("due.noDate")],
            ] as const
          ).map(([value, label]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </FilterMenu>

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange({ sort: filter.sort, includeArchived: filter.includeArchived })}
          className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-fg-subtle hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" aria-hidden />
          {t("common.clearFilters")}
        </button>
      )}

      <span className="flex-1" />

      {count !== undefined && (
        <span className="me-2 text-xs text-fg-subtle tabular-nums">
          {t("tasks.filter.count", { count })}
        </span>
      )}

      <label className="me-2 flex items-center gap-2 text-xs text-fg-muted">
        <Switch
          checked={filter.includeArchived ?? false}
          onCheckedChange={(includeArchived) => set({ includeArchived })}
          aria-label={t("common.showArchived")}
        />
        {t("common.showArchived")}
      </label>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line px-2 text-xs text-fg-muted hover:bg-hover hover:text-fg"
          >
            <ArrowDownUp className="size-3.5" aria-hidden />
            {t(`tasks.sort.${sort.field}`)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={sort.field}
            onValueChange={(field) => {
              const f = field as TaskSortField;
              // Sensible default direction per field.
              const direction = f === "due" || f === "title" || f === "manual" ? "asc" : "desc";
              set({ sort: { field: f, direction } });
            }}
          >
            {TASK_SORT_FIELDS.map((f) => (
              <DropdownMenuRadioItem key={f} value={f}>
                {t(`tasks.sort.${f}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {actions}
    </div>
  );
}

function FilterMenu({
  label,
  active,
  children,
}: {
  label: string;
  active: number;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-sm border px-2 text-xs transition-colors",
            active > 0
              ? "border-accent/50 bg-accent-soft text-accent-text"
              : "border-line text-fg-muted hover:bg-hover hover:text-fg",
          )}
        >
          {label}
          {active > 0 && <span className="tabular-nums">· {active}</span>}
          <ChevronDown className="size-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 overflow-y-auto">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

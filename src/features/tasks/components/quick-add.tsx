import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Folder,
  Plus,
  Signal,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { toast } from "@/app/toast-store";
import { parseQuickAdd, type QuickTokenKind } from "@/domain/quick-add";
import type { CreateTaskInput } from "@/domain/task";
import { formatLocalDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCategories } from "@/features/categories/use-categories";
import { useProjects } from "@/features/projects/use-projects";
import { useTaskActions } from "../use-task-actions";

const KIND_ICON: Record<QuickTokenKind, LucideIcon> = {
  due: CalendarDays,
  time: Clock,
  priority: Signal,
  project: Folder,
  category: Tag,
};

interface QuickAddProps {
  /** Context defaults (e.g. today's date on My Day, the project on a project page). Parsed tokens win. */
  defaults?: Partial<CreateTaskInput>;
  className?: string;
  autoFocus?: boolean;
}

/**
 * One-line task entry with inline syntax. Recognized tokens show as chips; clicking × on a chip
 * keeps that word as plain text instead.
 */
export function QuickAdd({ defaults = {}, className, autoFocus }: QuickAddProps) {
  const { t } = useTranslation();
  const { create } = useTaskActions();
  const { data: projects = [] } = useProjects();
  const { data: categories = [] } = useCategories();
  const [text, setText] = useState("");
  // Opt-outs remember the word too, so editing the text never un-parses the wrong word.
  const [ignored, setIgnored] = useState<Map<number, string>>(new Map());

  const words = text.trim().split(/\s+/);
  const ignore = useMemo(
    () => new Set([...ignored].filter(([i, w]) => words[i] === w).map(([i]) => i)),
    [ignored, words],
  );
  const parsed = useMemo(
    () => parseQuickAdd(text, { today: new Date(), projects, categories }, ignore),
    [text, projects, categories, ignore],
  );

  const submit = () => {
    if (!parsed.title.trim()) return;
    const input: CreateTaskInput = {
      ...defaults,
      title: parsed.title,
      ...(parsed.dueDate ? { dueDate: parsed.dueDate, dueTime: parsed.dueTime } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
    };
    create.mutate(input, {
      onSuccess: (task) => {
        setText("");
        setIgnored(new Map());
        toast.info(t("quickAdd.added", { title: task.title }));
      },
    });
  };

  const chipLabel = (kind: QuickTokenKind, label: string) =>
    kind === "due"
      ? formatLocalDate(label)
      : kind === "priority"
        ? t(`priority.${label as "low"}`)
        : label;

  return (
    <div
      className={cn(
        "rounded-md border border-line bg-surface focus-within:border-accent/60",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3">
        <Plus className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        <input
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              setText("");
              setIgnored(new Map());
            }
          }}
          placeholder={t("quickAdd.placeholder")}
          aria-label={t("quickAdd.label")}
          aria-describedby="quick-add-hint"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        {text.trim() && (
          <button
            type="button"
            onClick={submit}
            disabled={!parsed.title.trim() || create.isPending}
            className="h-7 rounded-sm bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {t("quickAdd.add")}
          </button>
        )}
      </div>
      {(parsed.tokens.length > 0 || parsed.unmatched.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
          {parsed.tokens.map((token) => (
            <span
              key={`${token.index}:${token.raw}`}
              className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-accent/40 bg-accent-soft ps-2 pe-1 text-xs text-accent-text"
              title={t(`quickAdd.kinds.${token.kind}`)}
            >
              {createElement(KIND_ICON[token.kind], { className: "size-3", "aria-hidden": true })}
              {chipLabel(token.kind, token.label)}
              <button
                type="button"
                aria-label={t("quickAdd.remove", { raw: token.raw })}
                title={t("quickAdd.remove", { raw: token.raw })}
                onClick={() => setIgnored((m) => new Map(m).set(token.index, token.raw))}
                className="inline-flex size-4 items-center justify-center rounded-xs hover:bg-accent-soft"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {parsed.unmatched.map((u) => (
            <span
              key={`u${u.index}`}
              className="inline-flex items-center gap-1 text-xs text-warning"
            >
              <AlertCircle className="size-3" aria-hidden />
              {u.kind === "project"
                ? t("quickAdd.unmatchedProject", { raw: u.raw })
                : t("quickAdd.unmatchedCategory", { raw: u.raw })}
            </span>
          ))}
        </div>
      )}
      <p id="quick-add-hint" className="sr-only">
        {t("quickAdd.hint")}
      </p>
    </div>
  );
}

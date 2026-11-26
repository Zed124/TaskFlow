import { useDeferredValue, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { FolderKanban, MessageSquareText, Search, Tag } from "lucide-react";
import { keys, useServiceQuery } from "@/app/data";
import { useUiStore } from "@/app/ui-store";
import { HIT_END, HIT_START, type SearchHit } from "@/db/repositories/search-repository";
import { StatusIcon } from "@/features/tasks/components/status-icon";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";

/** Renders FTS highlight markers as <mark>. */
function Highlighted({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    const start = rest.indexOf(HIT_START);
    if (start === -1) {
      parts.push(rest);
      break;
    }
    const end = rest.indexOf(HIT_END, start);
    parts.push(rest.slice(0, start));
    parts.push(
      <mark key={key++} className="rounded-xs bg-accent-soft text-accent-text">
        {rest.slice(start + 1, end === -1 ? undefined : end)}
      </mark>,
    );
    rest = end === -1 ? "" : rest.slice(end + 1);
  }
  return <>{parts}</>;
}

const GROUP_ORDER: SearchHit["kind"][] = ["task", "project", "category", "note"];

/** Ctrl+K: global full-text search. (Commands join this palette in Phase 4.) */
export function SearchDialog() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const navigate = useNavigate();
  const drawer = useTaskDrawer();
  const { data: hits = [] } = useServiceQuery(
    keys.search(deferred),
    (s) => s.search.search(deferred),
    {
      enabled: open && deferred.length > 0,
    },
  );
  const visible = deferred.length > 0 ? hits : [];

  const choose = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    switch (hit.kind) {
      case "task":
        drawer.open(hit.id);
        break;
      case "note":
        drawer.open(hit.taskId);
        break;
      case "project":
        void navigate(`/projects/${hit.id}`);
        break;
      case "category":
        void navigate(`/tasks?category=${hit.id}`);
        break;
    }
  };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/45" />
        <D.Content
          aria-describedby={undefined}
          className="fixed top-[14vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 animate-pop-in overflow-hidden rounded-lg border border-line-strong bg-surface shadow-popover focus:outline-none"
        >
          <D.Title className="sr-only">{t("topbar.search")}</D.Title>
          <Command shouldFilter={false} loop label={t("topbar.search")}>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("search.placeholder")}
                className="h-12 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
              />
              <kbd className="rounded-xs border border-line-strong px-1 text-2xs text-fg-subtle">
                Esc
              </kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              {deferred.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-fg-subtle">{t("search.hint")}</p>
              ) : (
                <Command.Empty className="px-3 py-6 text-center text-sm text-fg-subtle">
                  {t("search.empty", { query: deferred })}
                </Command.Empty>
              )}
              {GROUP_ORDER.map((kind) => {
                const group = visible.filter((h) => h.kind === kind);
                if (group.length === 0) return null;
                return (
                  <Command.Group
                    key={kind}
                    heading={t(`search.groups.${kind}`)}
                    className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle"
                  >
                    {group.map((hit) => (
                      <Command.Item
                        key={`${hit.kind}:${hit.id}`}
                        value={`${hit.kind}:${hit.id}`}
                        onSelect={() => choose(hit)}
                        className="flex cursor-default items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-fg data-[selected=true]:bg-hover"
                      >
                        <HitRow hit={hit} />
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function HitRow({ hit }: { hit: SearchHit }) {
  const { t } = useTranslation();
  switch (hit.kind) {
    case "task":
      return (
        <>
          <StatusIcon status={hit.status} />
          <div className="min-w-0 flex-1">
            <div className="truncate">
              <Highlighted text={hit.title} />
            </div>
            {(hit.parentTitle || hit.snippet.includes(HIT_START)) && (
              <div className="truncate text-xs text-fg-subtle">
                {hit.parentTitle ? (
                  t("search.subtaskOf", { title: hit.parentTitle })
                ) : (
                  <Highlighted text={hit.snippet} />
                )}
              </div>
            )}
          </div>
          {hit.archived && <span className="text-2xs text-fg-subtle">{t("common.archived")}</span>}
        </>
      );
    case "project":
      return (
        <>
          <FolderKanban className="size-4 shrink-0 text-fg-subtle" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            <Highlighted text={hit.title} />
          </span>
          {hit.archived && <span className="text-2xs text-fg-subtle">{t("common.archived")}</span>}
        </>
      );
    case "category":
      return (
        <>
          <Tag className="size-4 shrink-0 text-fg-subtle" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            <Highlighted text={hit.title} />
          </span>
        </>
      );
    case "note":
      return (
        <>
          <MessageSquareText
            className="size-4 shrink-0 text-accent-text"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="truncate">
              <Highlighted text={hit.snippet} />
            </div>
            <div className="truncate text-xs text-fg-subtle">
              {t("search.inTask", { title: hit.taskTitle })}
            </div>
          </div>
        </>
      );
  }
}

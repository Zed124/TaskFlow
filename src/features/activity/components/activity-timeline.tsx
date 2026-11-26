import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { keys, useServiceMutation, useServiceQuery } from "@/app/data";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import type { ActivityEvent } from "@/domain/activity";
import { formatInstant, formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDescribeEvent } from "../describe-event";
import { EventIcon } from "./event-icon";

/**
 * A task's history: compact system lines and card-style user notes, oldest first,
 * with a composer for new notes at the end.
 */
export function ActivityTimeline({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { data: events = [] } = useServiceQuery(keys.taskActivity(taskId), (s) =>
    s.activity.listForTask(taskId),
  );
  const [draft, setDraft] = useState("");
  const addNote = useServiceMutation((s, body: string) => s.activity.addNote(taskId, body), {
    onSuccess: () => setDraft(""),
  });

  const submit = () => {
    if (draft.trim()) addNote.mutate(draft);
  };

  return (
    <section aria-label={t("activity.title")}>
      <ol className="relative flex flex-col gap-1">
        {events.map((event) =>
          event.eventType === "note" ? (
            <NoteItem key={event.id} event={event} />
          ) : (
            <SystemItem key={event.id} event={event} />
          ),
        )}
      </ol>

      <div className="mt-3 rounded-md border border-line bg-canvas focus-within:border-accent">
        <AutoTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          minRows={2}
          placeholder={t("activity.notePlaceholder")}
          aria-label={t("activity.notePlaceholder")}
          className="px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
        />
        <div className="flex items-center justify-end gap-2 px-2 pb-2">
          <span className="text-2xs text-fg-subtle">Ctrl+Enter</span>
          <Button
            size="sm"
            variant="primary"
            disabled={!draft.trim()}
            loading={addNote.isPending}
            onClick={submit}
          >
            {t("activity.addNote")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function SystemItem({ event }: { event: ActivityEvent }) {
  const { t } = useTranslation();
  const describe = useDescribeEvent();
  return (
    <li
      className="flex items-start gap-2.5 py-1 text-xs text-fg-subtle"
      title={t("activity.systemEvent")}
    >
      <EventIcon type={event.eventType} className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 text-fg-muted">{describe(event)}</span>
      <time
        dateTime={event.occurredAt}
        title={formatInstant(event.occurredAt)}
        className="shrink-0 tabular-nums"
      >
        {formatRelative(event.occurredAt)}
      </time>
    </li>
  );
}

function NoteItem({ event }: { event: ActivityEvent }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(event.body ?? "");
  const edit = useServiceMutation((s, body: string) => s.activity.editNote(event.id, body), {
    onSuccess: () => setEditing(false),
  });

  return (
    <li className="group my-1.5 rounded-md border border-line bg-raised px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="font-medium text-accent-text">{t("activity.userNote")}</span>
        <time
          dateTime={event.occurredAt}
          title={formatInstant(event.occurredAt)}
          className="text-fg-subtle"
        >
          {formatRelative(event.occurredAt)}
        </time>
        {event.editedAt && (
          <span className="text-fg-subtle" title={formatInstant(event.editedAt)}>
            · {t("common.edited")}
          </span>
        )}
        <span className="flex-1" />
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setText(event.body ?? "");
              setEditing(true);
            }}
            aria-label={t("activity.editNote")}
            className="rounded-sm p-0.5 text-fg-subtle opacity-0 group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <AutoTextarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) edit.mutate(text);
            }}
            className="rounded-sm border border-line bg-canvas px-2 py-1 text-sm text-fg"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!text.trim()}
              loading={edit.isPending}
              onClick={() => edit.mutate(text)}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn("selectable text-sm whitespace-pre-wrap text-fg")}>{event.body}</p>
      )}
    </li>
  );
}

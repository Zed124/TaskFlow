import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useServiceQuery } from "@/app/data";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  moveWidget,
  normalizeLayout,
  WIDGET_SPAN,
  type DashboardLayout,
  type DashboardWidgetId,
} from "@/domain/dashboard";
import { cn } from "@/lib/cn";
import { useSetting } from "@/features/settings/use-settings";
import { useNow, useTodayKey } from "@/features/views/use-now";
import { WidgetBody, WidgetFrame } from "./components/widgets";

/** Overview with user-arranged widgets. Layout (order + visibility) persists in settings. */
export function DashboardPage() {
  const { t } = useTranslation();
  const [stored, setStored] = useSetting("dashboard.layout");
  const layout = useMemo(() => normalizeLayout(stored), [stored]);
  const [editing, setEditing] = useState(false);
  const shown = editing ? layout : layout.filter((w) => w.visible);

  const save = (next: DashboardLayout) => setStored(next);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = layout.findIndex((w) => w.id === active.id);
    const to = layout.findIndex((w) => w.id === over.id);
    save(arrayMove(layout, from, to));
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-(--tf-page-x) py-6">
      <Header editing={editing} onToggleEdit={() => setEditing((e) => !e)} />
      {editing && <p className="mb-3 text-xs text-fg-subtle">{t("dashboard.customizeHint")}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={shown.map((w) => w.id)}
          strategy={rectSortingStrategy}
          disabled={!editing}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((w) => (
              <SortableWidget
                key={w.id}
                id={w.id}
                visible={w.visible}
                editing={editing}
                isFirst={layout[0]?.id === w.id}
                isLast={layout.at(-1)?.id === w.id}
                onMove={(dir) => save(moveWidget(layout, w.id, dir))}
                onToggle={() =>
                  save(layout.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Header({ editing, onToggleEdit }: { editing: boolean; onToggleEdit: () => void }) {
  const { t } = useTranslation();
  const now = useNow();
  const dayKey = useTodayKey();
  const { data } = useServiceQuery(["stats", "header", dayKey], (s) => s.stats.dashboard(1, 1));
  const hour = now.getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return (
    <div className="mb-5 flex items-end gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-fg-subtle">{format(now, "EEEE, MMMM d")}</p>
        <h2 className="mt-0.5 font-display text-2xl font-semibold text-fg">
          {t(`dashboard.greeting.${greeting}`)}
        </h2>
        {data && (
          <p className="mt-1 text-sm text-fg-muted">
            {t("dashboard.summary", {
              dueToday: data.dueToday,
              overdue: data.overdue,
              inProgress: data.inProgress,
            })}
          </p>
        )}
      </div>
      <Button variant={editing ? "primary" : "secondary"} size="sm" onClick={onToggleEdit}>
        <SlidersHorizontal className="size-3.5" aria-hidden />
        {editing ? t("dashboard.done") : t("dashboard.customize")}
      </Button>
    </div>
  );
}

function SortableWidget({
  id,
  visible,
  editing,
  isFirst,
  isLast,
  onMove,
  onToggle,
}: {
  id: DashboardWidgetId;
  visible: boolean;
  editing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });
  const title = t(`dashboard.widgets.${id}`);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(WIDGET_SPAN[id] === "full" && "md:col-span-2", isDragging && "z-10 opacity-80")}
    >
      <WidgetFrame
        title={title}
        className={cn(editing && "border-dashed", editing && !visible && "opacity-50")}
        actions={
          editing ? (
            <div className="flex items-center gap-0.5">
              {!visible && (
                <span className="me-1 text-2xs text-fg-subtle">{t("dashboard.hidden")}</span>
              )}
              <IconButton
                icon={ArrowUp}
                size="sm"
                label={t("dashboard.moveUp")}
                disabled={isFirst}
                onClick={() => onMove(-1)}
              />
              <IconButton
                icon={ArrowDown}
                size="sm"
                label={t("dashboard.moveDown")}
                disabled={isLast}
                onClick={() => onMove(1)}
              />
              <IconButton
                icon={visible ? EyeOff : Eye}
                size="sm"
                label={visible ? t("dashboard.hide") : t("dashboard.show")}
                onClick={onToggle}
              />
              <button
                type="button"
                aria-label={title}
                className="inline-flex size-6 cursor-grab items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null
        }
      >
        {editing && !visible ? null : <WidgetBody id={id} />}
      </WidgetFrame>
    </div>
  );
}

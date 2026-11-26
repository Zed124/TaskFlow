import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  closestCorners,
  pointerWithin,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useServiceMutation } from "@/app/data";
import { useUiStore } from "@/app/ui-store";
import { ColorDot } from "@/components/ui/color-dot";
import { IconButton } from "@/components/ui/icon-button";
import { EMPTY, Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TASK_STATUSES, type TaskListItem, type TaskStatus } from "@/domain/task";
import { NONE, type TaskFilter } from "@/domain/task-filter";
import { cn } from "@/lib/cn";
import { DueLabel } from "@/features/tasks/components/due-label";
import { PriorityIcon } from "@/features/tasks/components/priority-icon";
import { StatusIcon } from "@/features/tasks/components/status-icon";
import { useTaskDrawer } from "@/features/tasks/use-task-drawer";
import { useTaskList } from "@/features/tasks/use-task-list";
import { useProjects } from "@/features/projects/use-projects";
import { ListTree } from "lucide-react";

type Columns = Record<TaskStatus, string[]>;

const isColumnId = (id: unknown) => (TASK_STATUSES as readonly unknown[]).includes(id);

/**
 * Kanban collision detection: whatever is under the pointer wins (a card over its column), so
 * tall empty columns are easy targets. Falls back to closest corners when the pointer is
 * between columns (and for keyboard dragging, which has no pointer).
 */
const boardCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) {
    const cards = within.filter((c) => !isColumnId(c.id));
    return cards.length > 0 ? cards : within;
  }
  return closestCorners(args);
};

function toColumns(tasks: readonly TaskListItem[]): Columns {
  const columns: Columns = { todo: [], in_progress: [], completed: [], cancelled: [] };
  for (const task of tasks) columns[task.status].push(task.id);
  return columns;
}

function findColumn(columns: Columns, id: string): TaskStatus | undefined {
  if ((TASK_STATUSES as readonly string[]).includes(id)) return id as TaskStatus;
  return TASK_STATUSES.find((s) => columns[s].includes(id));
}

/**
 * Kanban by status. Drag state lives in a local override of the columns; the drop is persisted
 * with one `tasks.move` call (status change + position) and the override clears once the
 * refreshed data arrives.
 */
export function BoardPage() {
  const { t } = useTranslation();
  const { open } = useTaskDrawer();
  const openCreate = useUiStore((s) => s.openCreateTask);
  const [projectFilter, setProjectFilter] = useState<string>(EMPTY);
  const { data: projects = [] } = useProjects();
  const filter: TaskFilter = useMemo(
    () => ({
      sort: { field: "manual", direction: "asc" },
      ...(projectFilter === EMPTY ? {} : { projectIds: [projectFilter] }),
    }),
    [projectFilter],
  );
  const { data, isPending } = useTaskList(filter);
  const byId = useMemo(() => new Map((data ?? []).map((t) => [t.id, t])), [data]);
  const serverColumns = useMemo(() => toColumns(data ?? []), [data]);
  const [override, setOverride] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = override ?? serverColumns;

  const move = useServiceMutation(
    (s, v: { id: string; status: TaskStatus; orderedIds: string[] }) =>
      s.tasks.move(v.id, { status: v.status, orderedIds: v.orderedIds }),
  );

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so plain clicks still open the drawer.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverride(serverColumns);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setOverride((current) => {
      const cols = current ?? serverColumns;
      const from = findColumn(cols, String(active.id));
      const to = findColumn(cols, String(over.id));
      if (!from || !to || from === to) return cols;
      // Move across columns now so the card visibly joins the target column while dragging.
      const target = cols[to];
      const overIndex = target.indexOf(String(over.id));
      const insertAt = overIndex < 0 ? target.length : overIndex;
      return {
        ...cols,
        [from]: cols[from].filter((id) => id !== active.id),
        [to]: [...target.slice(0, insertAt), String(active.id), ...target.slice(insertAt)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const cols = override ?? serverColumns;
    const id = String(active.id);
    const to = over ? findColumn(cols, String(over.id)) : undefined;
    const task = byId.get(id);
    if (!over || !to || !task) {
      setOverride(null);
      return;
    }
    let ordered = cols[to];
    const oldIndex = ordered.indexOf(id);
    const newIndex = ordered.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex)
      ordered = arrayMove(ordered, oldIndex, newIndex);
    const finalCols = { ...cols, [to]: ordered };
    setOverride(finalCols);

    const unchanged = task.status === to && serverColumns[to].join() === ordered.join();
    if (unchanged) {
      setOverride(null);
      return;
    }
    move.mutate({ id, status: to, orderedIds: ordered }, { onSettled: () => setOverride(null) });
  };

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-(--tf-page-x) py-2">
        <Select
          aria-label={t("tasks.project")}
          value={projectFilter}
          onValueChange={setProjectFilter}
          className="h-7 w-52 text-xs"
          options={[
            { value: EMPTY, label: t("board.allProjects") },
            { value: NONE, label: t("tasks.noProject") },
            ...projects.map((p) => ({
              value: p.id,
              label: p.name,
              icon: <ColorDot color={p.color} />,
            })),
          ]}
        />
        <p className="truncate text-xs text-fg-subtle">{t("board.dragHint")}</p>
      </div>

      {isPending ? (
        <div className="grid flex-1 grid-cols-4 gap-3 p-(--tf-page-x)">
          {TASK_STATUSES.map((s) => (
            <Skeleton key={s} className="h-40" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={boardCollision}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverride(null);
          }}
        >
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-x-auto px-(--tf-page-x) py-4">
            {TASK_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                ids={columns[status]}
                byId={byId}
                onOpen={open}
                onAdd={() =>
                  openCreate({
                    status,
                    ...(projectFilter !== EMPTY && projectFilter !== NONE
                      ? { projectId: projectFilter }
                      : {}),
                  })
                }
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
            {active ? <CardBody task={active} lifted /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function BoardColumn({
  status,
  ids,
  byId,
  onOpen,
  onAdd,
}: {
  status: TaskStatus;
  ids: string[];
  byId: Map<string, TaskListItem>;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const label = t(`status.${status}`);

  return (
    <section
      aria-label={label}
      className={cn(
        "flex min-h-0 min-w-56 flex-col rounded-lg border border-line bg-surface/60 transition-colors",
        isOver && "border-accent/50 bg-accent-soft/30",
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 px-3">
        <StatusIcon status={status} />
        <h2 className="text-xs font-semibold text-fg">{label}</h2>
        <span className="text-xs text-fg-subtle tabular-nums">{ids.length}</span>
        <span className="flex-1" />
        <IconButton
          icon={Plus}
          size="sm"
          label={t("board.addTo", { column: label })}
          onClick={onAdd}
        />
      </header>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2"
        >
          {ids.map((id) => {
            const task = byId.get(id);
            return task ? <SortableCard key={id} task={task} onOpen={onOpen} /> : null;
          })}
          {ids.length === 0 && (
            <p className="m-auto py-6 text-xs text-fg-subtle">{t("board.empty")}</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, onOpen }: { task: TaskListItem; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isDragging && "opacity-30",
      )}
      {...attributes}
      {...listeners}
      aria-label={task.title}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(task.id);
      }}
    >
      <CardBody task={task} />
    </div>
  );
}

function CardBody({ task, lifted }: { task: TaskListItem; lifted?: boolean }) {
  const closed = task.status === "completed" || task.status === "cancelled";
  return (
    <div
      className={cn(
        "cursor-grab rounded-md border border-line bg-raised px-3 py-2.5 text-sm transition-shadow hover:border-line-strong",
        lifted && "rotate-[1.5deg] cursor-grabbing border-accent/50 shadow-popover",
      )}
    >
      <div className="flex items-start gap-2">
        <PriorityIcon priority={task.priority} className="mt-0.5" />
        <span
          className={cn(
            "min-w-0 flex-1 leading-snug",
            closed ? "text-fg-subtle line-through" : "text-fg",
          )}
        >
          {task.title}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ps-6 text-xs text-fg-subtle empty:hidden">
        {task.dueDate && (
          <DueLabel dueDate={task.dueDate} dueTime={task.dueTime} status={task.status} />
        )}
        {task.subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <ListTree className="size-3.5" strokeWidth={1.75} aria-hidden />
            {task.subtaskDoneCount}/{task.subtaskCount}
          </span>
        )}
        {task.categoryName && (
          <span className="inline-flex items-center gap-1">
            <ColorDot color={task.categoryColor} />
            {task.categoryName}
          </span>
        )}
        {task.projectName && <span className="truncate">{task.projectName}</span>}
      </div>
    </div>
  );
}

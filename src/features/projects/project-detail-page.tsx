import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronLeft, FolderX, Plus } from "lucide-react";
import { useUiStore } from "@/app/ui-store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { entityColor } from "@/domain/colors";
import type { TaskFilter } from "@/domain/task-filter";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskList } from "@/features/tasks/components/task-list";
import { useTaskList } from "@/features/tasks/use-task-list";
import { ProjectMenu } from "./components/project-menu";
import { ProgressBar } from "./components/progress-bar";
import { useProject } from "./use-projects";

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: project, isPending } = useProject(projectId);
  const openCreate = useUiStore((s) => s.openCreateTask);
  const [filter, setFilter] = useState<TaskFilter>({
    sort: { field: "created", direction: "desc" },
  });
  const scoped: TaskFilter = { ...filter, projectIds: [projectId] };
  const { data: tasks } = useTaskList(scoped);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (!project) {
    return (
      <EmptyState
        icon={FolderX}
        title={t("projects.notFound")}
        action={
          <Link to="/projects" className="text-sm text-accent-text">
            {t("projects.back")}
          </Link>
        }
      />
    );
  }

  const color = entityColor(project.color);
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line px-(--tf-page-x) pt-4 pb-4">
        <Link
          to="/projects"
          className="mb-3 inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          {t("projects.back")}
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-xs"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold text-fg">
            {project.name}
          </h2>
          {project.archivedAt && (
            <span className="rounded-xs border border-line-strong px-1.5 text-2xs text-fg-subtle">
              {t("projects.archivedBadge")}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={() => openCreate({ projectId: project.id })}>
            <Plus className="size-3.5" aria-hidden />
            {t("projects.addTask")}
          </Button>
          <ProjectMenu project={project} onDeleted={() => void navigate("/projects")} />
        </div>
        {project.description && (
          <p className="selectable mt-2 max-w-2xl text-sm text-fg-muted">{project.description}</p>
        )}
        <div className="mt-4 max-w-md">
          <ProgressBar progress={project.progress} color={color} />
        </div>
      </header>

      <TaskFilters filter={filter} onChange={setFilter} hideProject count={tasks?.length} />
      <TaskList
        filter={scoped}
        showProject={false}
        onCreate={() => openCreate({ projectId: project.id })}
      />
    </div>
  );
}

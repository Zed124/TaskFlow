import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { entityColorHex } from "@/domain/colors";
import { cn } from "@/lib/cn";
import { ProjectFormDialog } from "./components/project-form-dialog";
import { ProjectMenu } from "./components/project-menu";
import { ProgressBar } from "./components/progress-bar";
import { useProjects } from "./use-projects";

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: projects, isPending } = useProjects(showArchived);

  return (
    <div className="mx-auto w-full max-w-4xl px-(--tf-page-x) py-6">
      <div className="mb-4 flex items-center gap-3">
        <p className="flex-1 text-xs text-fg-subtle">{t("projects.archiveHint")}</p>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <Switch
            checked={showArchived}
            onCheckedChange={setShowArchived}
            aria-label={t("common.showArchived")}
          />
          {t("common.showArchived")}
        </label>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" aria-hidden />
          {t("projects.new")}
        </Button>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={FolderKanban}
          title={t("projects.empty.title")}
          description={t("projects.empty.body")}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t("projects.new")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <li key={p.id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => void navigate(`/projects/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void navigate(`/projects/${p.id}`);
                }}
                className={cn(
                  "group flex cursor-default flex-col gap-2.5 rounded-md border border-line bg-surface px-4 py-3 transition-colors",
                  "hover:border-line-strong hover:bg-raised focus-visible:border-accent focus-visible:outline-none",
                  p.archivedAt && "opacity-70",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: entityColorHex(p.color) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                    {p.name}
                  </span>
                  {p.archivedAt && (
                    <span className="rounded-xs border border-line-strong px-1.5 text-2xs text-fg-subtle">
                      {t("projects.archivedBadge")}
                    </span>
                  )}
                  <span className="text-xs text-fg-subtle tabular-nums">
                    {t("projects.counts", {
                      open: p.progress.open,
                      inProgress: p.progress.inProgress,
                      completed: p.progress.completed,
                    })}
                  </span>
                  <ProjectMenu project={p} />
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-xs text-fg-muted">{p.description}</p>
                )}
                <ProgressBar progress={p.progress} color={entityColorHex(p.color)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSaved={(p) => void navigate(`/projects/${p.id}`)}
        />
      )}
    </div>
  );
}

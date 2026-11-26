import { useTranslation } from "react-i18next";
import { Inbox, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { isFilterEmpty, type TaskFilter } from "@/domain/task-filter";
import { TaskRows } from "./task-rows";
import { useTaskList } from "../use-task-list";

interface TaskListProps {
  filter: TaskFilter;
  showProject?: boolean;
  onCreate?: () => void;
}

export function TaskList({ filter, showProject = true, onCreate }: TaskListProps) {
  const { t } = useTranslation();
  const { data, isPending } = useTaskList(filter);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 px-(--tf-page-x) py-4" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    const filtered = !isFilterEmpty(filter);
    return (
      <EmptyState
        icon={filtered ? SearchX : Inbox}
        title={filtered ? t("tasks.empty.filteredTitle") : t("tasks.empty.title")}
        description={filtered ? t("tasks.empty.filteredBody") : t("tasks.empty.body")}
        action={
          !filtered && onCreate ? (
            <Button variant="primary" onClick={onCreate}>
              {t("tasks.create.title")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return <TaskRows tasks={data} label={t("nav.allTasks")} showProject={showProject} />;
}

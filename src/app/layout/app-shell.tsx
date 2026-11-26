import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { useSetting } from "@/features/settings/use-settings";
import { useAppearanceSync } from "@/features/settings/appearance";
import { SearchDialog } from "@/features/search/search-dialog";
import { CreateTaskDialog } from "@/features/tasks/components/create-task-dialog";
import { TaskDrawer } from "@/features/tasks/components/task-drawer";
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog";
import { useNavigate } from "react-router";
import { findNavItem } from "../navigation";
import { useUiStore } from "../ui-store";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useSetting("ui.sidebarCollapsed");
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const openCreate = useUiStore((s) => s.openCreateTask);
  const createProjectOpen = useUiStore((s) => s.createProjectOpen);
  const setCreateProjectOpen = useUiStore((s) => s.setCreateProjectOpen);
  const navigate = useNavigate();
  useAppearanceSync();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        // Works from anywhere, including text fields.
        event.preventDefault();
        setSearchOpen(true);
      } else if (key === "n") {
        event.preventDefault();
        openCreate();
      } else if (key === "b" && !isEditableTarget(event.target)) {
        event.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, setCollapsed, setSearchOpen, openCreate]);

  const item = findNavItem(pathname);
  const title = item ? t(item.labelKey) : t("app.name");

  return (
    <div className="flex h-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
      <TaskDrawer />
      <CreateTaskDialog />
      <SearchDialog />
      {createProjectOpen && (
        <ProjectFormDialog
          onClose={() => setCreateProjectOpen(false)}
          onSaved={(p) => void navigate(`/projects/${p.id}`)}
        />
      )}
      <Toaster />
    </div>
  );
}

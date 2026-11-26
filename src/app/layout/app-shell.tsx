import { Suspense, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollContainerContext } from "../scroll-container";
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
import { useDesktopIntegration } from "@/features/system/use-desktop-integration";
import { useNotificationScheduler } from "@/features/notifications/use-notification-scheduler";
import { useBackupScheduler } from "@/features/backup/use-backup-scheduler";
import { OnboardingDialog } from "@/features/onboarding/onboarding-dialog";
import { useUiStore } from "../ui-store";
import { useUndo } from "../use-undo";
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
  const { undoLast } = useUndo();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useAppearanceSync();
  useDesktopIntegration();
  useNotificationScheduler();
  useBackupScheduler();

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
      } else if (key === "z" && !isEditableTarget(event.target)) {
        // In text fields Ctrl+Z stays the browser's text undo.
        event.preventDefault();
        void undoLast();
      } else if (key === "b" && !isEditableTarget(event.target)) {
        event.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, setCollapsed, setSearchOpen, openCreate, undoLast]);

  const item = findNavItem(pathname);
  const title = item ? t(item.labelKey) : t("app.name");

  return (
    <div className="flex h-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto">
          <ScrollContainerContext.Provider value={scroller}>
            {/* Shown only while a page's code chunk loads (first visit to that page). */}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </ScrollContainerContext.Provider>
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
      <OnboardingDialog />
      <Toaster />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex flex-col gap-2 px-(--tf-page-x) py-6" aria-busy>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

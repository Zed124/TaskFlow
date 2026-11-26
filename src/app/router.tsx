import type { ReactNode } from "react";
import { createHashRouter, Navigate } from "react-router";
import { AppShell } from "./layout/app-shell";
import { navItems, type NavItem } from "./navigation";
import { PlannedPage } from "./pages/planned-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TasksPage } from "@/features/tasks/tasks-page";
import { ProjectsPage } from "@/features/projects/projects-page";
import { ProjectDetailPage } from "@/features/projects/project-detail-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { ActivityPage } from "@/features/activity/activity-page";

/** Pages that exist. Anything else in the sidebar renders its honest "planned" placeholder. */
const PAGES: Partial<Record<string, ReactNode>> = {
  tasks: <TasksPage />,
  projects: <ProjectsPage />,
  categories: <CategoriesPage />,
  activity: <ActivityPage />,
  settings: <SettingsPage />,
};

function pageFor(item: NavItem): ReactNode {
  const page = PAGES[item.id];
  if (page) return page;
  if (item.planned) return <PlannedPage item={{ ...item, planned: item.planned }} />;
  throw new Error(`No page registered for nav item "${item.id}"`);
}

/** Hash routing: works with Tauri's custom protocol without server-side rewrites. */
export function createAppRouter() {
  return createHashRouter([
    {
      path: "/",
      element: <AppShell />,
      children: [
        ...navItems.map((item) =>
          item.path === "/"
            ? { index: true, element: pageFor(item) }
            : { path: item.path.slice(1), element: pageFor(item) },
        ),
        { path: "projects/:projectId", element: <ProjectDetailPage /> },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ]);
}

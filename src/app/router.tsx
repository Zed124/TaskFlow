import { lazy, type ComponentType, type ReactNode } from "react";
import { createHashRouter, Navigate } from "react-router";
import { AppShell } from "./layout/app-shell";
import { navItems, type NavItem } from "./navigation";
import { PlannedPage } from "./pages/planned-page";

/**
 * Pages are code-split: each loads on first visit, so startup only parses the shell and the
 * page being opened. Heavy libraries (charts, drag-and-drop) ride along with the pages that use
 * them. The shell shows a fallback while a page chunk loads (see AppShell).
 */
function page<M extends Record<string, unknown>>(
  load: () => Promise<M>,
  name: keyof M,
): ComponentType {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const DashboardPage = page(() => import("@/features/dashboard/dashboard-page"), "DashboardPage");
const TasksPage = page(() => import("@/features/tasks/tasks-page"), "TasksPage");
const TodayPage = page(() => import("@/features/views/smart-list-pages"), "TodayPage");
const UpcomingPage = page(() => import("@/features/views/smart-list-pages"), "UpcomingPage");
const OverduePage = page(() => import("@/features/views/smart-list-pages"), "OverduePage");
const InProgressPage = page(() => import("@/features/views/smart-list-pages"), "InProgressPage");
const CompletedPage = page(() => import("@/features/views/smart-list-pages"), "CompletedPage");
const BoardPage = page(() => import("@/features/views/board-page"), "BoardPage");
const CalendarPage = page(() => import("@/features/views/calendar-page"), "CalendarPage");
const TimelinePage = page(() => import("@/features/views/timeline-page"), "TimelinePage");
const ProjectsPage = page(() => import("@/features/projects/projects-page"), "ProjectsPage");
const ProjectDetailPage = page(
  () => import("@/features/projects/project-detail-page"),
  "ProjectDetailPage",
);
const CategoriesPage = page(
  () => import("@/features/categories/categories-page"),
  "CategoriesPage",
);
const ActivityPage = page(() => import("@/features/activity/activity-page"), "ActivityPage");
const AnalyticsPage = page(() => import("@/features/analytics/analytics-page"), "AnalyticsPage");
const SettingsPage = page(() => import("@/features/settings/settings-page"), "SettingsPage");

/** Pages that exist. Anything else in the sidebar renders its honest "planned" placeholder. */
const PAGES: Partial<Record<string, ComponentType>> = {
  dashboard: DashboardPage,
  today: TodayPage,
  upcoming: UpcomingPage,
  overdue: OverduePage,
  "in-progress": InProgressPage,
  completed: CompletedPage,
  board: BoardPage,
  calendar: CalendarPage,
  timeline: TimelinePage,
  tasks: TasksPage,
  projects: ProjectsPage,
  categories: CategoriesPage,
  activity: ActivityPage,
  analytics: AnalyticsPage,
  settings: SettingsPage,
};

function pageFor(item: NavItem): ReactNode {
  const Page = PAGES[item.id];
  if (Page) return <Page />;
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

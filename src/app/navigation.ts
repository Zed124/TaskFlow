import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  FolderKanban,
  GanttChart,
  History,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  SquareKanban,
  Sun,
  Tags,
  TriangleAlert,
  CalendarClock,
} from "lucide-react";
import type { ParseKeys } from "i18next";

export type NavSectionId = "main" | "organization" | "insights" | "application";
export type PlannedScope = "core" | "views" | "analytics";

export interface NavItem {
  id: string;
  path: string;
  icon: LucideIcon;
  labelKey: ParseKeys;
  section: NavSectionId;
  /** Set while the page is not built yet; drives the honest placeholder. */
  planned?: { phase: number; scope: PlannedScope };
}

export const navItems: readonly NavItem[] = [
  {
    id: "dashboard",
    path: "/",
    icon: LayoutDashboard,
    labelKey: "nav.dashboard",
    section: "main",
  },
  {
    id: "tasks",
    path: "/tasks",
    icon: Inbox,
    labelKey: "nav.allTasks",
    section: "main",
  },
  {
    id: "today",
    path: "/today",
    icon: Sun,
    labelKey: "nav.today",
    section: "main",
  },
  {
    id: "upcoming",
    path: "/upcoming",
    icon: CalendarClock,
    labelKey: "nav.upcoming",
    section: "main",
  },
  {
    id: "overdue",
    path: "/overdue",
    icon: TriangleAlert,
    labelKey: "nav.overdue",
    section: "main",
  },
  {
    id: "in-progress",
    path: "/in-progress",
    icon: CircleDot,
    labelKey: "nav.inProgress",
    section: "main",
  },
  {
    id: "completed",
    path: "/completed",
    icon: CheckCircle2,
    labelKey: "nav.completed",
    section: "main",
  },
  {
    id: "calendar",
    path: "/calendar",
    icon: CalendarDays,
    labelKey: "nav.calendar",
    section: "main",
  },
  {
    id: "board",
    path: "/board",
    icon: SquareKanban,
    labelKey: "nav.board",
    section: "main",
  },
  {
    id: "timeline",
    path: "/timeline",
    icon: GanttChart,
    labelKey: "nav.timeline",
    section: "main",
  },
  {
    id: "projects",
    path: "/projects",
    icon: FolderKanban,
    labelKey: "nav.projects",
    section: "organization",
  },
  {
    id: "categories",
    path: "/categories",
    icon: Tags,
    labelKey: "nav.categories",
    section: "organization",
  },
  {
    id: "analytics",
    path: "/analytics",
    icon: BarChart3,
    labelKey: "nav.analytics",
    section: "insights",
  },
  {
    id: "activity",
    path: "/activity",
    icon: History,
    labelKey: "nav.activity",
    section: "insights",
  },
  {
    id: "settings",
    path: "/settings",
    icon: Settings,
    labelKey: "nav.settings",
    section: "application",
  },
];

export const navSections: readonly { id: NavSectionId; labelKey: ParseKeys }[] = [
  { id: "main", labelKey: "nav.sections.main" },
  { id: "organization", labelKey: "nav.sections.organization" },
  { id: "insights", labelKey: "nav.sections.insights" },
  { id: "application", labelKey: "nav.sections.application" },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return (
    navItems.find((item) => item.path === pathname) ??
    navItems.find((item) => item.path !== "/" && pathname.startsWith(`${item.path}/`))
  );
}

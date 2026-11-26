import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  FolderKanban,
  FolderPlus,
  Palette,
  PanelLeft,
  Plus,
  Rows3,
  type LucideIcon,
} from "lucide-react";
import { THEME_CHOICES } from "@/domain/themes";
import { navItems } from "@/app/navigation";
import { useUiStore } from "@/app/ui-store";
import { useSetting } from "@/features/settings/use-settings";
import { useProjects } from "@/features/projects/use-projects";

export interface PaletteCommand {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string[];
  /** Extra words that should match (e.g. "go", "open"). */
  keywords?: string;
  run: () => void;
}

/** Everything the command palette can do, built from live app state. */
export function useCommands(): PaletteCommand[] {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openCreate = useUiStore((s) => s.openCreateTask);
  const openCreateProject = useUiStore((s) => s.setCreateProjectOpen);
  const [collapsed, setCollapsed] = useSetting("ui.sidebarCollapsed");
  const [density, setDensity] = useSetting("ui.density");
  const [theme, setTheme] = useSetting("ui.theme");
  const { data: projects = [] } = useProjects();

  return useMemo(() => {
    const next = density === "compact" ? "comfortable" : "compact";
    const commands: PaletteCommand[] = [
      {
        id: "new-task",
        label: t("commands.newTask"),
        icon: Plus,
        shortcut: ["Ctrl", "N"],
        keywords: "add new",
        run: () => openCreate(),
      },
      {
        id: "new-project",
        label: t("commands.newProject"),
        icon: FolderPlus,
        keywords: "add new",
        run: () => openCreateProject(true),
      },
      ...navItems.map((item) => ({
        id: `go-${item.id}`,
        label: t("commands.goTo", { page: t(item.labelKey) }),
        icon: item.icon,
        keywords: "go navigate open page",
        run: () => void navigate(item.path),
      })),
      ...projects.map((p) => ({
        id: `project-${p.id}`,
        label: t("commands.openProject", { name: p.name }),
        icon: FolderKanban,
        keywords: "project",
        run: () => void navigate(`/projects/${p.id}`),
      })),
      {
        id: "toggle-sidebar",
        label: t("commands.toggleSidebar"),
        icon: PanelLeft,
        shortcut: ["Ctrl", "B"],
        run: () => setCollapsed(!collapsed),
      },
      {
        id: "toggle-density",
        label: t("commands.toggleDensity", {
          density: t(`settings.appearance.${next}`).toLowerCase(),
        }),
        icon: Rows3,
        keywords: "density compact comfortable layout",
        run: () => setDensity(next),
      },
      ...THEME_CHOICES.filter((choice) => choice !== theme).map((choice) => ({
        id: `theme-${choice}`,
        label: t("commands.useTheme", { theme: t(`settings.themes.${choice}.name`) }),
        icon: Palette,
        keywords: "theme appearance color light dark mode",
        run: () => setTheme(choice),
      })),
    ];
    return commands;
  }, [
    t,
    navigate,
    openCreate,
    openCreateProject,
    collapsed,
    setCollapsed,
    density,
    setDensity,
    theme,
    setTheme,
    projects,
  ]);
}

/** Every query word must prefix-match some word of the label or keywords. */
export function matchCommand(command: PaletteCommand, query: string): boolean {
  const words = `${command.label} ${command.keywords ?? ""}`.toLowerCase().split(/[\s,]+/);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((q) => words.some((w) => w.startsWith(q)));
}

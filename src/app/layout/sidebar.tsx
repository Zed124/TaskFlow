import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { navItems, navSections, type NavItem } from "../navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex h-full shrink-0 flex-col border-e border-line bg-sidebar transition-[width] duration-150 ease-out-quart",
        collapsed ? "w-[52px]" : "w-[232px]",
      )}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center",
          collapsed ? "justify-center" : "justify-between ps-4 pe-2",
        )}
      >
        {!collapsed && <AppMark />}
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? t("nav.expand") : t("nav.collapse")}
          shortcut={["Ctrl", "B"]}
          tooltipSide="right"
          onClick={onToggle}
        />
      </div>

      <nav
        aria-label={t("nav.primary")}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3"
      >
        {navSections.map((section) => {
          const items = navItems.filter((item) => item.section === section.id);
          return (
            <div key={section.id} className="mt-3 first:mt-1">
              {collapsed ? (
                <div className="mx-2 mb-1.5 h-px bg-line first:hidden" aria-hidden />
              ) : (
                <div className="px-2 pb-1 text-2xs font-medium text-fg-subtle">
                  {t(section.labelKey)}
                </div>
              )}
              <ul className="flex flex-col gap-px">
                {items.map((item) => (
                  <li key={item.id}>
                    <SidebarLink item={item} collapsed={collapsed} label={t(item.labelKey)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function SidebarLink({
  item,
  collapsed,
  label,
}: {
  item: NavItem;
  collapsed: boolean;
  label: string;
}) {
  const Icon = item.icon;
  return (
    <Tooltip content={label} side="right" disabled={!collapsed}>
      <NavLink
        to={item.path}
        end
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            "group relative flex h-[30px] items-center gap-2.5 rounded-sm text-sm transition-colors duration-100",
            collapsed ? "justify-center" : "px-2",
            isActive ? "bg-pressed text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                className="absolute inset-y-1.5 -start-2 w-[3px] rounded-e-full bg-accent"
                aria-hidden
              />
            )}
            <Icon
              className={cn(
                "size-4 shrink-0",
                isActive ? "text-accent-text" : "text-fg-subtle group-hover:text-fg-muted",
              )}
              strokeWidth={1.75}
              aria-hidden
            />
            {!collapsed && <span className="truncate">{label}</span>}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}

/** The TaskFlow logo (same artwork as app-icon.svg / the app icon), drawn inline. */
function AppMark() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 112 112" className="size-6" aria-hidden>
        <rect
          width="112"
          height="112"
          rx="26"
          fill="#131318"
          stroke="#ffffff"
          strokeOpacity="0.12"
          strokeWidth="2"
        />
        <path
          d="M24 38 C32 31 38 34 44 40 L52 48 L88 24"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 64 C34 55 44 73 56 64 S78 55 88 64"
          fill="none"
          stroke="#a1a1b0"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M24 84 C34 75 44 93 56 84 S78 75 88 84"
          fill="none"
          stroke="#6c6c7a"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-fg">
        TaskFlow
      </span>
    </div>
  );
}

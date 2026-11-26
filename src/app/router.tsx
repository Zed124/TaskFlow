import { createHashRouter, Navigate } from "react-router";
import { AppShell } from "./layout/app-shell";
import { navItems, type NavItem } from "./navigation";
import { PlannedPage } from "./pages/planned-page";
import { SettingsPage } from "@/features/settings/settings-page";

function pageFor(item: NavItem) {
  if (item.id === "settings") return <SettingsPage />;
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
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ]);
}

import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
import type { NavItem } from "../navigation";

/** Honest placeholder for a page that isn't implemented yet. It never shows fake data. */
export function PlannedPage({ item }: { item: NavItem & Required<Pick<NavItem, "planned">> }) {
  const { t } = useTranslation();
  const page = t(item.labelKey);
  return (
    <EmptyState
      className="h-full"
      icon={item.icon}
      title={t("placeholder.title", { page })}
      description={t("placeholder.body", {
        phase: item.planned.phase,
        scope: t(`placeholder.scopes.${item.planned.scope}`),
      })}
    />
  );
}

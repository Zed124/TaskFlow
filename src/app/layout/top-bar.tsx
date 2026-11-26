import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";

export function TopBar({ title }: { title: string }) {
  const { t } = useTranslation();

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line px-(--tf-page-x)">
      <h1 className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-fg">
        {title}
      </h1>

      {/* Disabled until the command palette exists (Phase 4) — it must not look functional before then. */}
      <Tooltip content={t("topbar.searchUnavailable")}>
        <span tabIndex={0} className="rounded-sm">
          <button
            type="button"
            disabled
            aria-label={t("topbar.search")}
            className="flex h-7 w-64 items-center gap-2 rounded-sm border border-line bg-surface px-2 text-xs text-fg-subtle opacity-60"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="flex-1 text-start">{t("topbar.search")}</span>
            <Kbd keys={["Ctrl", "K"]} />
          </button>
        </span>
      </Tooltip>
    </header>
  );
}

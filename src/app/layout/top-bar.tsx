import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { IconButton } from "@/components/ui/icon-button";
import { useUiStore } from "../ui-store";

export function TopBar({ title }: { title: string }) {
  const { t } = useTranslation();
  const openSearch = useUiStore((s) => s.setSearchOpen);
  const openCreate = useUiStore((s) => s.openCreateTask);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-(--tf-page-x)">
      <h1 className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-fg">
        {title}
      </h1>

      <button
        type="button"
        onClick={() => openSearch(true)}
        className="flex h-7 w-64 items-center gap-2 rounded-sm border border-line bg-surface px-2 text-xs text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 truncate text-start">{t("topbar.search")}</span>
        <Kbd keys={["Ctrl", "K"]} />
      </button>
      <IconButton
        icon={Plus}
        label={t("topbar.newTask")}
        shortcut={["Ctrl", "N"]}
        onClick={() => openCreate()}
      />
    </header>
  );
}

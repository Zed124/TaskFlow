import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ListFilter, MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useServiceMutation } from "@/app/data";
import { toast } from "@/app/toast-store";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorDot } from "@/components/ui/color-dot";
import type { CategoryWithCount } from "@/domain/category";
import type { EntityColor } from "@/domain/colors";
import { useCategories } from "./use-categories";

export function CategoriesPage() {
  const { t } = useTranslation();
  const { data: categories, isPending } = useCategories();
  const [name, setName] = useState("");
  const [color, setColor] = useState<EntityColor>("slate");
  const create = useServiceMutation(
    (s, input: { name: string; color: EntityColor }) => s.categories.create(input),
    { onSuccess: () => setName("") },
  );

  const submit = () => {
    if (name.trim()) create.mutate({ name, color });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-(--tf-page-x) py-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mb-5 flex flex-col gap-3 rounded-md border border-line bg-surface p-3"
      >
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("categories.namePlaceholder")}
            aria-label={t("categories.new")}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim()}
            loading={create.isPending}
          >
            <Plus className="size-3.5" aria-hidden />
            {t("categories.add")}
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} label={t("projects.color")} />
      </form>

      {isPending ? (
        <Skeleton className="h-24" />
      ) : !categories?.length ? (
        <EmptyState
          icon={Tags}
          title={t("categories.empty.title")}
          description={t("categories.empty.body")}
        />
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRow({ category }: { category: CategoryWithCount }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const [confirming, setConfirming] = useState(false);
  const update = useServiceMutation(
    (s, patch: { name?: string; color?: EntityColor }) => s.categories.update(category.id, patch),
    { onSuccess: () => setRenaming(false) },
  );
  const remove = useServiceMutation((s) => s.categories.delete(category.id), {
    onSuccess: () => toast.info(t("categories.deleted")),
  });

  return (
    <li className="flex h-11 items-center gap-3 px-3">
      <ColorDot color={category.color} className="size-2.5" />
      {renaming ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() =>
            name.trim() && name !== category.name ? update.mutate({ name }) : setRenaming(false)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setName(category.name);
              setRenaming(false);
            }
          }}
          className="h-7"
          aria-label={t("categories.rename")}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-fg">{category.name}</span>
      )}
      <span className="shrink-0 text-xs text-fg-subtle tabular-nums">
        {t("categories.counts", { open: category.openTaskCount, total: category.taskCount })}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton icon={MoreHorizontal} label={t("common.more")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            icon={ListFilter}
            onSelect={() => void navigate(`/tasks?category=${category.id}`)}
          >
            {t("categories.viewTasks")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={Pencil}
            onSelect={() => {
              setName(category.name);
              setRenaming(true);
            }}
          >
            {t("categories.rename")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("categories.color")}</DropdownMenuLabel>
          <div className="px-2 pb-1.5">
            <ColorPicker
              value={category.color}
              onChange={(c) => update.mutate({ color: c })}
              label={t("categories.color")}
            />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={Trash2} destructive onSelect={() => setConfirming(true)}>
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("categories.deleteConfirmTitle", { name: category.name })}
        description={t("categories.deleteConfirmBody", { count: category.taskCount })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => remove.mutate(undefined)}
      />
    </li>
  );
}

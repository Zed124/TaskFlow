import type { ComponentProps, ReactNode } from "react";
import { DropdownMenu as M } from "radix-ui";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={4}
        align="start"
        className={cn(
          "z-50 min-w-44 animate-pop-in rounded-md border border-line-strong bg-overlay p-1 shadow-popover",
          className,
        )}
        {...props}
      />
    </M.Portal>
  );
}

interface ItemProps extends ComponentProps<typeof M.Item> {
  icon?: LucideIcon;
  shortcut?: string[];
  destructive?: boolean;
  children: ReactNode;
}

export function DropdownMenuItem({
  icon: Icon,
  shortcut,
  destructive,
  className,
  children,
  ...props
}: ItemProps) {
  return (
    <M.Item
      className={cn(
        "flex h-7 items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none select-none",
        "data-[disabled]:opacity-45 data-[highlighted]:bg-hover",
        destructive && "text-danger",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-4 text-fg-subtle" strokeWidth={1.75} aria-hidden />}
      <span className="flex-1">{children}</span>
      {shortcut && <Kbd keys={shortcut} />}
    </M.Item>
  );
}

export function DropdownMenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <M.Label className="px-2 pt-1.5 pb-1 text-2xs font-medium text-fg-subtle">{children}</M.Label>
  );
}

const checkable =
  "relative flex h-7 items-center gap-2 rounded-sm ps-7 pe-2 text-sm text-fg outline-none select-none data-[highlighted]:bg-hover";

/** Multi-select item; keeps the menu open so several options can be toggled. */
export function DropdownMenuCheckboxItem({
  children,
  className,
  onSelect,
  ...props
}: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem
      className={cn(checkable, className)}
      onSelect={(event) => {
        event.preventDefault();
        onSelect?.(event);
      }}
      {...props}
    >
      <M.ItemIndicator className="absolute start-2 inline-flex">
        <Check className="size-3.5 text-accent-text" aria-hidden />
      </M.ItemIndicator>
      {children}
    </M.CheckboxItem>
  );
}

export const DropdownMenuRadioGroup = M.RadioGroup;

export function DropdownMenuRadioItem({
  children,
  className,
  ...props
}: ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(checkable, className)} {...props}>
      <M.ItemIndicator className="absolute start-2 inline-flex">
        <Check className="size-3.5 text-accent-text" aria-hidden />
      </M.ItemIndicator>
      {children}
    </M.RadioItem>
  );
}

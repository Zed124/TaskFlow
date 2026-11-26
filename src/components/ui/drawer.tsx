import type { ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Rendered in the header next to the close button (e.g. status, menu). */
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Side panel anchored to the inline-end edge. Used for task details so the page underneath stays put.
 * Non-modal overlay is intentionally light: the list behind stays readable for context.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  headerActions,
  children,
  className,
}: DrawerProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-30 animate-fade-in bg-black/25" />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-y-0 end-0 z-40 flex w-[min(560px,92vw)] animate-slide-in-end flex-col",
            "border-s border-line-strong bg-surface shadow-drawer focus:outline-none",
            className,
          )}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
            <D.Title className="min-w-0 flex-1 truncate text-sm font-medium text-fg-muted">
              {title}
            </D.Title>
            {headerActions}
            <D.Close
              aria-label="Close"
              className="inline-flex size-7 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

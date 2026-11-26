import type { ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered modal. Focus is trapped and restored; Escape closes. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 animate-fade-in bg-scrim" />
        <D.Content
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 animate-pop-in",
            "rounded-lg border border-line-strong bg-surface shadow-popover focus:outline-none",
            className,
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-4">
            <div>
              <D.Title className="font-display text-base font-semibold text-fg">{title}</D.Title>
              {description && (
                <D.Description className="mt-0.5 text-sm text-fg-muted">
                  {description}
                </D.Description>
              )}
            </div>
            <D.Close
              aria-label="Close"
              className="-me-1.5 inline-flex size-7 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </D.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

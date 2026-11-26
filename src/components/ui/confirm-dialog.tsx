import { AlertDialog as A } from "radix-ui";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** Explicit confirmation for destructive actions. Focus starts on Cancel. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[70] animate-fade-in bg-scrim" />
        <A.Content className="fixed top-[20vh] left-1/2 z-[70] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 animate-pop-in rounded-lg border border-line-strong bg-surface p-5 shadow-popover focus:outline-none">
          <A.Title className="font-display text-base font-semibold text-fg">{title}</A.Title>
          <A.Description className="mt-2 text-sm text-fg-muted">{description}</A.Description>
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </A.Cancel>
            <A.Action asChild>
              <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}

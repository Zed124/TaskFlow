import { X } from "lucide-react";
import { useToastStore } from "@/app/toast-store";
import { cn } from "@/lib/cn";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed end-4 bottom-4 z-[80] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex animate-pop-in items-center gap-3 rounded-md border bg-overlay py-2 ps-3.5 pe-2 text-sm shadow-popover",
            t.tone === "error" ? "border-danger/40 text-fg" : "border-line-strong text-fg",
          )}
        >
          {t.tone === "error" && (
            <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
          )}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="rounded-sm px-2 py-1 text-sm font-medium text-accent-text hover:bg-hover"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="inline-flex size-6 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg"
            onClick={() => dismiss(t.id)}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

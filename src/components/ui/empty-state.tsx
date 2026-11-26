import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-lg bg-accent-soft blur-xl" aria-hidden />
        <div className="relative flex size-12 items-center justify-center rounded-lg border border-line-strong bg-raised">
          <Icon className="size-5 text-accent-text" strokeWidth={1.75} aria-hidden />
        </div>
      </div>
      <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

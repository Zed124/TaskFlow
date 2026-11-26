import type { TaskStatus } from "@/domain/task";
import { cn } from "@/lib/cn";

/**
 * Drawn status glyphs (Linear-style): an empty ring, a half-filled ring, a filled check,
 * a crossed ring. Shape carries the meaning, so color is a bonus, not a requirement.
 */
export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const common = cn("size-4 shrink-0", className);
  switch (status) {
    case "todo":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-fg-subtle")} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "in_progress":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-warning")} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />
        </svg>
      );
    case "completed":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-accent")} aria-hidden>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5 8.2l2 2 4-4.4"
            fill="none"
            stroke="var(--color-accent-fg)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "cancelled":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-fg-subtle")} aria-hidden>
          <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.35" />
          <path
            d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"
            stroke="var(--color-canvas)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

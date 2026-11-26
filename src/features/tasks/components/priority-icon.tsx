import type { TaskPriority } from "@/domain/task";
import { cn } from "@/lib/cn";

const FILLED: Record<Exclude<TaskPriority, "urgent">, number> = { low: 1, medium: 2, high: 3 };

/**
 * Signal-bar glyph: 1–3 bars for low/medium/high, a solid alert square for urgent.
 * Only urgent uses a loud color so lists stay calm.
 */
export function PriorityIcon({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  if (priority === "urgent") {
    return (
      <svg
        viewBox="0 0 16 16"
        className={cn("size-4 shrink-0 text-priority-urgent", className)}
        aria-hidden
      >
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" />
        <path d="M8 4.5v4.5" stroke="var(--color-canvas)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r="1" fill="var(--color-canvas)" />
      </svg>
    );
  }
  const filled = FILLED[priority];
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn(
        "size-4 shrink-0",
        priority === "high" ? "text-priority-high" : "text-fg-muted",
        className,
      )}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2.5 + i * 4}
          y={10 - i * 3.5}
          width="3"
          height={4 + i * 3.5}
          rx="1"
          fill="currentColor"
          opacity={i < filled ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

import { cn } from "@/lib/cn";

/** Loading placeholder that mirrors the shape of the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-raised", className)} />;
}

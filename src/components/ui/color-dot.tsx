import { entityColorHex } from "@/domain/colors";
import { cn } from "@/lib/cn";

/** Small swatch for a project/category color token. */
export function ColorDot({
  color,
  className,
}: {
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: entityColorHex(color) }}
    />
  );
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./tooltip";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  /** Required: used as the accessible name and the tooltip. */
  label: string;
  shortcut?: string[];
  tooltipSide?: "top" | "right" | "bottom" | "left";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, shortcut, tooltipSide, size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm text-fg-subtle transition-colors duration-100",
          "hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-45",
          size === "sm" ? "size-6" : "size-7",
          className,
        )}
        {...props}
      >
        <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={1.75} aria-hidden />
      </button>
    </Tooltip>
  );
});

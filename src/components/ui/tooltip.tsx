import type { ReactNode } from "react";
import { Tooltip as T } from "radix-ui";
import { Kbd } from "./kbd";

export const TooltipProvider = T.Provider;

interface TooltipProps {
  content: ReactNode;
  shortcut?: string[];
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
  disabled?: boolean;
}

export function Tooltip({ content, shortcut, side = "bottom", children, disabled }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 flex animate-fade-in items-center gap-2 rounded-sm border border-line-strong bg-overlay px-2 py-1 text-xs text-fg shadow-popover"
        >
          {content}
          {shortcut && <Kbd keys={shortcut} />}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

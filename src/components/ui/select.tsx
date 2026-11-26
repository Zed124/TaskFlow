import type { ReactNode } from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Radix Select can't use "" as a value; this sentinel stands for "nothing selected". */
export const EMPTY = "__empty__";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  "aria-label": string;
  disabled?: boolean;
  className?: string;
  /** Looks like plain text until hovered — for property rows in the drawer. */
  variant?: "field" | "ghost";
}

export function Select({
  value,
  onValueChange,
  options,
  disabled,
  className,
  variant = "field",
  "aria-label": ariaLabel,
}: SelectProps) {
  const current = options.find((o) => o.value === value);
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 min-w-0 items-center gap-2 rounded-sm px-2 text-sm text-fg outline-none",
          "transition-colors disabled:opacity-50 data-[placeholder]:text-fg-subtle",
          variant === "field"
            ? "border border-line bg-canvas hover:border-line-strong focus-visible:border-accent"
            : "hover:bg-hover focus-visible:bg-hover",
          className,
        )}
      >
        {current?.icon}
        <span className="min-w-0 flex-1 truncate text-start">
          <S.Value>{current?.label}</S.Value>
        </span>
        <S.Icon>
          <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] animate-pop-in overflow-hidden rounded-md border border-line-strong bg-overlay shadow-popover"
        >
          <S.Viewport className="p-1">
            {options.map((option) => (
              <S.Item
                key={option.value}
                value={option.value}
                className="relative flex h-7 cursor-default items-center gap-2 rounded-sm ps-2 pe-7 text-sm text-fg outline-none select-none data-[highlighted]:bg-hover"
              >
                {option.icon}
                <S.ItemText>{option.label}</S.ItemText>
                <S.ItemIndicator className="absolute end-2">
                  <Check className="size-3.5 text-accent-text" aria-hidden />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

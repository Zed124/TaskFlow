import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly Option<T>[];
  onValueChange: (value: T) => void;
  "aria-label": string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(next) => {
        const match = options.find((o) => o.value === next);
        if (match) onValueChange(match.value); // ignore deselect (empty string)
      }}
      className="inline-flex rounded-sm border border-line bg-canvas p-0.5"
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "h-6 rounded-xs px-2.5 text-xs text-fg-muted transition-colors",
            "hover:text-fg data-[state=on]:bg-raised data-[state=on]:text-fg data-[state=on]:shadow-[0_0_0_1px_var(--color-line-strong)]",
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

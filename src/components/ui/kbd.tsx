import { cn } from "@/lib/cn";

/** Keyboard hint, e.g. <Kbd keys={["Ctrl", "K"]} />. */
export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-line-strong bg-canvas px-1 font-sans text-2xs leading-none text-fg-muted"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

import { Switch as S } from "radix-ui";
import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch({ className, ...props }: SwitchProps & { className?: string }) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-line-strong bg-raised transition-colors",
        "disabled:opacity-45 data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-3 translate-x-[3px] rounded-full bg-fg-muted transition-transform duration-150 ease-out-quart data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-accent-fg" />
    </S.Root>
  );
}

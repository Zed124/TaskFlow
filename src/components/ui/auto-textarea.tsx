import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface AutoTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  minRows?: number;
}

/** Textarea that grows with its content. Unstyled beyond sizing; callers style it. */
export function AutoTextarea({ value, minRows = 1, className, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent outline-none",
        className,
      )}
      {...props}
    />
  );
}

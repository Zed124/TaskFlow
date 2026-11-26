import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-sm border border-line bg-canvas px-2.5 text-sm text-fg placeholder:text-fg-subtle " +
  "transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none " +
  "focus:shadow-[0_0_0_3px_var(--color-accent-soft)] disabled:opacity-45 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(field, "h-8", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(field, "min-h-20 resize-y py-2", className)} {...props} />
  );
});

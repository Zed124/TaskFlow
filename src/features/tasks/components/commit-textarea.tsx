import { useState, type TextareaHTMLAttributes } from "react";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface CommitTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onBlur"
> {
  value: string;
  /** Called on blur (or Enter when singleLine) if the text changed. */
  onCommit: (value: string) => void;
  singleLine?: boolean;
  /** Reject empty values by reverting (e.g. titles). */
  required?: boolean;
  minRows?: number;
}

/**
 * Edits locally and saves once, on blur — so history gets one meaningful
 * "description changed" event instead of one per keystroke. Escape reverts.
 */
export function CommitTextarea({
  value,
  onCommit,
  singleLine,
  required,
  ...props
}: CommitTextareaProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const shown = focused ? draft : value;

  const commit = () => {
    const next = singleLine ? draft.replace(/\s*\n\s*/g, " ") : draft;
    if (required && !next.trim()) {
      setDraft(value);
      return;
    }
    if (next !== value) onCommit(next);
  };

  return (
    <AutoTextarea
      {...props}
      value={shown}
      onFocus={() => {
        setDraft(value);
        setFocused(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
          e.stopPropagation(); // keep the drawer open
        } else if (singleLine && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

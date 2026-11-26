import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface DueFieldProps {
  dueDate: string | null;
  dueTime: string | null;
  onChange: (dueDate: string | null, dueTime: string | null) => void;
}

const input =
  "h-8 rounded-sm bg-transparent px-2 text-sm text-fg outline-none [color-scheme:dark] hover:bg-hover focus:bg-canvas focus:shadow-[0_0_0_1px_var(--color-line-strong)]";

/** Native date (and optional time) inputs: keyboard-friendly and localized by the OS. */
export function DueField({ dueDate, dueTime, onChange }: DueFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        aria-label={t("due.label")}
        value={dueDate ?? ""}
        onChange={(e) => onChange(e.target.value || null, e.target.value ? dueTime : null)}
        className={input}
      />
      {dueDate && (
        <>
          <input
            type="time"
            aria-label={t("due.time")}
            value={dueTime ?? ""}
            onChange={(e) => onChange(dueDate, e.target.value || null)}
            className={input}
          />
          <button
            type="button"
            aria-label={t("due.clear")}
            title={t("due.clear")}
            onClick={() => onChange(null, null)}
            className="inline-flex size-7 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

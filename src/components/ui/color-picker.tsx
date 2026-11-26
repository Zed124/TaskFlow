import { useTranslation } from "react-i18next";
import { ENTITY_COLOR_NAMES, ENTITY_COLORS, type EntityColor } from "@/domain/colors";
import { cn } from "@/lib/cn";

/** Radio group of the entity color tokens. */
export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: EntityColor | null;
  onChange: (color: EntityColor) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {ENTITY_COLOR_NAMES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t(`colors.${c}`)}
          title={t(`colors.${c}`)}
          onClick={() => onChange(c)}
          className={cn(
            "size-5 rounded-full border-2 transition-transform hover:scale-110",
            value === c ? "border-fg" : "border-transparent",
          )}
          style={{ backgroundColor: ENTITY_COLORS[c] }}
        />
      ))}
    </div>
  );
}

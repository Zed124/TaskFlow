import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { THEME_CHOICES, THEME_INFO, type Theme, type ThemeChoice } from "@/domain/themes";

/**
 * Theme cards with a miniature of the app in each theme. A radio group: arrow keys move the
 * selection, like the Windows settings pickers.
 */
export function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeChoice;
  onChange: (value: ThemeChoice) => void;
}) {
  const { t } = useTranslation();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (index + step + THEME_CHOICES.length) % THEME_CHOICES.length;
    const choice = THEME_CHOICES[next];
    if (!choice) return;
    onChange(choice);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.appearance.theme")}
      className="grid grid-cols-3 gap-3 pb-4"
    >
      {THEME_CHOICES.map((choice, index) => {
        const selected = choice === value;
        return (
          <button
            key={choice}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(choice)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "group rounded-md border p-1.5 text-start transition-colors duration-100",
              selected
                ? "border-accent bg-accent-soft"
                : "border-line hover:border-line-strong hover:bg-hover",
            )}
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-sm border border-line">
              {choice === "system" ? (
                <>
                  <Miniature theme="light" />
                  <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
                    <Miniature theme="dark" />
                  </div>
                </>
              ) : (
                <Miniature theme={choice} />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-0.5">
              <div className="min-w-0">
                <div className="truncate text-sm text-fg">
                  {t(`settings.themes.${choice}.name`)}
                </div>
                <div
                  className={cn("truncate text-xs", selected ? "text-fg-muted" : "text-fg-subtle")}
                >
                  {t(`settings.themes.${choice}.hint`)}
                </div>
              </div>
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full",
                  selected ? "bg-accent-solid text-accent-fg" : "border border-line-strong",
                )}
                aria-hidden
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** A tiny sketch of the app (sidebar, header, a card with rows) in a theme's own colors. */
function Miniature({ theme }: { theme: Theme }) {
  const c = THEME_INFO[theme].preview;
  const bar = (width: string, color: string, opacity = 1) => (
    <div className="h-1 rounded-full" style={{ width, backgroundColor: color, opacity }} />
  );
  return (
    <div className="absolute inset-0 flex" style={{ backgroundColor: c.canvas }} aria-hidden>
      <div
        className="flex w-[28%] flex-col gap-1.5 p-1.5"
        style={{ backgroundColor: c.sidebar, borderInlineEnd: `1px solid ${c.line}` }}
      >
        <div className="mb-0.5 size-2 rounded-[2px] bg-accent" />
        {bar("80%", c.muted, 0.7)}
        <div className="h-1 w-[70%] rounded-full bg-accent" />
        {bar("60%", c.muted, 0.5)}
        {bar("75%", c.muted, 0.5)}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {bar("45%", c.fg, 0.9)}
        <div
          className="flex flex-1 flex-col justify-center gap-1.5 rounded-[3px] px-1.5"
          style={{ backgroundColor: c.surface, border: `1px solid ${c.line}` }}
        >
          {(["85%", "65%", "75%"] as const).map((w, i) => (
            <div key={w} className="flex items-center gap-1">
              <div
                className={cn("size-1.5 shrink-0 rounded-full", i === 0 && "bg-accent")}
                style={i === 0 ? undefined : { border: `1px solid ${c.muted}` }}
              />
              {bar(w, c.fg, i === 0 ? 0.35 : 0.6)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

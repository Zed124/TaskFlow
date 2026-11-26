import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Day {
  date: string;
  completed: number;
}

/**
 * Single-series bar chart: tasks completed per day. One hue (accent), thin bars with rounded
 * data ends on a shared baseline, a full-height hover target per day with a tooltip, and a
 * visually hidden table for screen readers.
 */
export function CompletionChart({ days }: { days: Day[] }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.completed));
  const hovered = hover !== null ? days[hover] : undefined;
  const last = days.at(-1);

  return (
    <figure className="relative">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs text-fg-muted">
          {t("dashboard.stats.chartLabel", { days: days.length })}
        </span>
        <span className="text-2xs text-fg-subtle">{t("dashboard.stats.chartNote")}</span>
      </figcaption>

      <div className="relative h-32" onMouseLeave={() => setHover(null)}>
        {/* Recessive guide and label for the max value, above the plot area */}
        <span
          className="absolute end-0 top-0 text-2xs leading-none text-fg-subtle tabular-nums"
          aria-hidden
        >
          {max}
        </span>
        <div className="absolute inset-x-0 top-4 border-t border-dashed border-line" aria-hidden />
        <div className="absolute inset-x-0 top-4 bottom-0 flex items-end gap-0.5" aria-hidden>
          {days.map((d, i) => (
            <div
              key={d.date}
              className="flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)}
            >
              <div
                className={cn(
                  "w-full max-w-5 rounded-t-[4px] transition-colors",
                  d.completed === 0
                    ? "h-[2px] rounded-none bg-line-strong"
                    : hover === i
                      ? "bg-accent-hover"
                      : "bg-accent",
                )}
                style={d.completed ? { height: `${(d.completed / max) * 100}%` } : undefined}
              />
            </div>
          ))}
        </div>
        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute -top-5 z-10 -translate-x-1/2 rounded-sm border border-line-strong bg-overlay px-2 py-1 text-xs whitespace-nowrap text-fg shadow-popover"
            style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
          >
            <span className="text-fg-muted">
              {format(parseLocalDate(hovered.date), "EEE, MMM d")}
            </span>{" "}
            <span className="font-semibold tabular-nums">{hovered.completed}</span>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-2xs text-fg-subtle tabular-nums" aria-hidden>
        <span>{days[0] && format(parseLocalDate(days[0].date), "MMM d")}</span>
        <span>{last && format(parseLocalDate(last.date), "MMM d")}</span>
      </div>

      <table className="sr-only">
        <caption>{t("dashboard.stats.chartLabel", { days: days.length })}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

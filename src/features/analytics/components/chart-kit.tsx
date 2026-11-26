import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";

export function ChartCard({
  title,
  note,
  legend,
  table,
  tableLabel,
  children,
  className,
}: {
  title: string;
  note?: string;
  legend?: { label: string; color: string }[];
  table?: ReactNode;
  tableLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface p-4 ${className ?? ""}`}
      aria-label={title}
    >
      <header className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {legend && (
          <ul className="flex items-center gap-3 text-xs text-fg-muted">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ backgroundColor: l.color }}
                  aria-hidden
                />
                {l.label}
              </li>
            ))}
          </ul>
        )}
        {note && <p className="w-full text-xs text-fg-subtle">{note}</p>}
      </header>
      {children}
      {table && (
        <details className="mt-2">
          <summary className="cursor-default text-xs text-fg-subtle select-none hover:text-fg-muted">
            {tableLabel}
          </summary>
          <div className="mt-2 max-h-64 overflow-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

/** Tooltip in app styling: text in text colors, a color chip beside each value. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: Partial<TooltipContentProps<number, string>> & {
  format?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-line-strong bg-overlay px-2.5 py-1.5 text-xs shadow-popover">
      <div className="mb-1 text-fg-muted">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-[2px]" style={{ backgroundColor: p.color }} aria-hidden />
          <span className="text-fg-muted">{p.name}</span>
          <span className="ms-auto ps-3 font-semibold text-fg tabular-nums">
            {format ? format(Number(p.value), String(p.dataKey)) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-fg-subtle">
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`py-1 font-medium ${i === 0 ? "text-start" : "text-end"}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-fg-muted tabular-nums">
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-t border-line">
            {r.map((c, i) => (
              <td key={i} className={`py-1 ${i === 0 ? "text-start" : "text-end"}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

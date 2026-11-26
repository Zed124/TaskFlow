import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-sm font-semibold text-fg">{title}</h2>
      <div className="divide-y divide-line rounded-md border border-line bg-surface px-4">
        {children}
      </div>
    </section>
  );
}

export function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm text-fg">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

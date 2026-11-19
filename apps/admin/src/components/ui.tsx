import type { ReactNode } from "react";
import { delta, formatPercent } from "@/lib/format";

export function Card({ title, subtitle, actions, children, className = "", refreshing = false }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  refreshing?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5 ${className}`} data-refreshing={refreshing}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-[0.95rem] font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[0.82rem] text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.4rem] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Variation signée par rapport à la période précédente ; la couleur dit si c'est une bonne nouvelle. */
export function Delta({ current, previous, upIsGood = true }: { current: number; previous: number; upIsGood?: boolean }) {
  const d = delta(current, previous);
  if (d === null) return <span className="text-[0.78rem] text-muted">nouveau sur la période</span>;
  if (d === 0) return <span className="text-[0.78rem] text-muted">= période précédente</span>;
  const good = d > 0 === upIsGood;
  return (
    <span className={`inline-flex items-center gap-1 text-[0.78rem] font-medium ${good ? "text-good" : "text-bad"}`}>
      <span aria-hidden="true">{d > 0 ? "▲" : "▼"}</span>
      {d > 0 ? "+" : "−"}
      {formatPercent(Math.abs(d))}
      <span className="font-normal text-muted">vs période précédente</span>
    </span>
  );
}

export function StatTile({ label, value, hint, children }: { label: string; value: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <p className="text-[0.82rem] text-muted">{label}</p>
      <p className="mt-1.5 truncate text-[1.65rem] leading-tight font-semibold tracking-tight">{value}</p>
      <div className="mt-1 min-h-[1.2rem]">{children}</div>
      {hint && <p className="mt-1 text-[0.75rem] text-muted">{hint}</p>}
    </div>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const styles = { info: "border-line bg-raised text-ink-2", warn: "border-warn/40 bg-warn/10 text-ink", error: "border-bad/40 bg-bad/10 text-ink" }[tone];
  const icon = { info: "ⓘ", warn: "⚠", error: "✕" }[tone];
  return (
    <p role={tone === "error" ? "alert" : undefined} className={`flex gap-2 rounded-lg border px-3 py-2 text-[0.85rem] ${styles}`}>
      <span aria-hidden="true">{icon}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Devises présentes sans taux : jamais converties au hasard, l'écran le dit. */
export function MissingRates({ currencies, reference }: { currencies: string[]; reference: string }) {
  if (!currencies.length) return null;
  return (
    <Note tone="warn">
      Sans taux de change saisi vers {reference} : {currencies.join(", ")}. Ces ventes restent comptées dans leur devise, mais pas dans les
      totaux en {reference}. Saisissez un taux dans « Revenus ».
    </Note>
  );
}

/** Données du graphique sous forme de tableau : identité jamais portée par la couleur seule. */
export function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <details className="mt-3 text-[0.82rem]">
      <summary className="cursor-pointer text-muted hover:text-ink">Afficher les données</summary>
      <div className="relative mt-2 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="tabular w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-raised">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-medium whitespace-nowrap text-ink-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="space-y-2">
      <Note tone="error">{message}</Note>
      {onRetry && (
        <button type="button" onClick={onRetry} className="h-8 rounded-lg border border-line px-3 text-[0.82rem] hover:bg-raised">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-muted">Chargement…</p>;
}

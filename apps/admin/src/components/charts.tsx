"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatDay, formatDayLong, formatMonthShort, formatInt } from "@/lib/format";

export type Interval = "day" | "week" | "month";

/** Libellé de l'axe des X : jour, semaine (« sem. du … ») ou mois. */
export const xTick = (interval: Interval) => (date: string) => (interval === "month" ? formatMonthShort(date) : formatDay(date));
const tooltipTitle = (interval: Interval, date: string) =>
  interval === "month" ? formatMonthShort(date) : interval === "week" ? `Semaine du ${formatDay(date)}` : formatDayLong(date);

const axis = { stroke: "var(--chart-axis)", tickLine: false, tick: { fill: "var(--chart-text)", fontSize: 12 } } as const;

function TooltipBox({ title, rows, footer }: { title: string; rows: Array<{ key: string; color?: string; label: string; value: ReactNode; dashed?: boolean }>; footer?: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-[0.8rem] shadow-lg">
      <p className="mb-1.5 text-muted">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-ink-2">
              {r.color && <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: r.color }} />}
              {r.label}
            </span>
            <strong className="tabular font-semibold text-ink">{r.value}</strong>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 border-t border-line pt-1.5 text-muted">{footer}</div>}
    </div>
  );
}

/**
 * Colonnes d'une seule série (ex. chiffre d'affaires converti par jour).
 * Une seule série : pas de légende, le titre de la carte dit ce qui est tracé.
 */
export function ColumnChart<T extends { date: string }>({
  data,
  value,
  interval,
  format = formatInt,
  label,
  details,
  height = 240,
}: {
  data: T[];
  value: (row: T) => number;
  interval: Interval;
  format?: (n: number) => string;
  label: string;
  /** Lignes supplémentaires de l'infobulle (ex. montants par devise d'origine). */
  details?: (row: T) => Array<{ label: string; value: string }>;
  height?: number;
}) {
  const rows = data.map((d) => ({ ...d, __v: value(d) }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" {...axis} tickFormatter={xTick(interval)} minTickGap={24} />
          <YAxis {...axis} axisLine={false} width={52} tickFormatter={(n: number) => formatCompact(n)} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as (T & { __v: number }) | undefined) : undefined;
              if (!row) return null;
              const extra = details?.(row) ?? [];
              return (
                <TooltipBox
                  title={tooltipTitle(interval, row.date)}
                  rows={[{ key: "v", label, value: format(row.__v) }, ...extra.map((x, i) => ({ key: `d${i}`, label: x.label, value: x.value }))]}
                />
              );
            }}
          />
          <Bar dataKey="__v" name={label} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type LineSeries<T> = { key: string; label: string; color: string; value: (row: T) => number };

/**
 * Plusieurs séries de MÊME unité sur un seul axe (ex. inscriptions et publications).
 * Légende toujours présente ; infobulle : toutes les séries à la date pointée.
 */
export function LinesChart<T extends { date: string }>({
  data,
  series,
  interval,
  format = formatInt,
  height = 240,
}: {
  data: T[];
  series: Array<LineSeries<T>>;
  interval: Interval;
  format?: (n: number) => string;
  height?: number;
}) {
  const rows = data.map((d) => ({ date: d.date, ...Object.fromEntries(series.map((s) => [s.key, s.value(d)])) }));
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-ink-2" aria-label="Légende">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" {...axis} tickFormatter={xTick(interval)} minTickGap={24} />
            <YAxis {...axis} axisLine={false} width={44} tickFormatter={(n: number) => formatCompact(n)} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={tooltipTitle(interval, String(label))}
                    rows={series.map((s) => ({
                      key: s.key,
                      color: s.color,
                      label: s.label,
                      value: format(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0)),
                    }))}
                  />
                ) : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: s.color, stroke: "var(--chart-surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Barres horizontales d'une seule série, valeur au bout de la barre (classements, répartitions). */
export function BarList({ rows, max, emptyText = "Aucune donnée sur la période." }: { rows: Array<{ key: string; label: ReactNode; value: number; display: string; hint?: string }>; max?: number; emptyText?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-[0.85rem] text-muted">{emptyText}</p>;
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)] items-center gap-3 text-[0.85rem]" title={r.hint}>
          <span className="truncate text-ink-2">{r.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-3 min-w-0 rounded-r-[4px] bg-[var(--series-1)]" style={{ width: `${Math.max((r.value / top) * 100, r.value > 0 ? 1.5 : 0)}%`, maxWidth: "calc(100% - 4.5rem)" }} />
            <span className="tabular shrink-0 text-ink">{r.display}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

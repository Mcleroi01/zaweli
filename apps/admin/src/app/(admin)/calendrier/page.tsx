"use client";

import type { CalendarDay, CalendarEvent } from "@zaweli/shared-types";
import { useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, ErrorState, Loading, MissingRates, PageHeader } from "@/components/ui";
import { formatDayLong, formatInt, formatMoney, formatMonth } from "@/lib/format";
import { today } from "@/lib/range";
import { useData } from "@/lib/use-data";

const METRICS = [
  { id: "revenueTotal", label: "Chiffre d'affaires" },
  { id: "signups", label: "Inscriptions" },
  { id: "paidOrders", label: "Ventes" },
  { id: "publications", label: "Publications" },
  { id: "newSubscriptions", label: "Nouveaux abonnements" },
] as const;
type Metric = (typeof METRICS)[number]["id"];
const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const EVENT_LABELS: Record<CalendarEvent["kind"], string> = {
  license_expirations: "Fin de licences",
  exchange_rate: "Nouveau taux",
  plan_price: "Nouveau prix",
};

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

export default function CalendarPage() {
  const { api, tz } = useAdmin();
  const now = today(tz);
  const [month, setMonth] = useState(now.slice(0, 7));
  const [metric, setMetric] = useState<Metric>("revenueTotal");
  const [selected, setSelected] = useState<string | null>(null);
  const cal = useData(`calendar:${month}:${tz}`, () => api.calendar(month, tz));
  // Pendant le chargement d'un autre mois, le précédent reste affiché (atténué).
  const data = cal.data;

  const value = (d: CalendarDay) => (metric === "revenueTotal" ? Number(d.revenueTotal) : d[metric]);
  const ref = data?.referenceCurrency ?? "USD";
  const show = (d: CalendarDay) => (metric === "revenueTotal" ? formatMoney(d.revenueTotal, ref, { compact: true }) : formatInt(d[metric]));
  const max = data ? Math.max(0, ...data.days.map(value)) : 0;
  const bucket = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.min(6, Math.ceil((v / max) * 6)));

  const first = data?.days[0]?.date ?? `${month}-01`;
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const eventsOf = (date: string) => data?.events.filter((e) => e.date === date) ?? [];
  const day = data?.days.find((d) => d.date === selected) ?? null;
  const monthTotal = data?.days.reduce((s, d) => s + value(d), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Calendrier"
        description={`Chaque jour du mois, dans le fuseau ${tz} : activité, ventes et échéances.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mois précédent" className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-raised">
              ←
            </button>
            <span className="min-w-36 text-center text-[0.95rem] font-medium capitalize">{formatMonth(month)}</span>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= now.slice(0, 7)}
              aria-label="Mois suivant"
              className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-raised disabled:opacity-40"
            >
              →
            </button>
            <button type="button" onClick={() => setMonth(now.slice(0, 7))} className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-raised">
              Ce mois-ci
            </button>
          </div>
        }
      />
      {cal.error && <ErrorState message={cal.error} onRetry={cal.reload} />}
      {!data && !cal.error && <Loading />}
      {data && (
        <div className="space-y-5" data-refreshing={cal.refreshing}>
          {metric === "revenueTotal" && <MissingRates currencies={data.missingRates} reference={ref} />}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <Card
              title={METRICS.find((m) => m.id === metric)!.label}
              subtitle={`Total du mois : ${metric === "revenueTotal" ? formatMoney(monthTotal, ref) : formatInt(monthTotal)}. La barre sous chaque jour est proportionnelle au plus haut du mois.`}
              actions={
                <label className="text-[0.82rem] text-ink-2">
                  <span className="sr-only">Indicateur</span>
                  <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[0.85rem]">
                    {METRICS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              }
            >
              <div className="grid grid-cols-7 gap-1 text-[0.72rem] text-muted sm:gap-1.5">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="pb-1 text-center">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Jours de ${formatMonth(month)}`}>
                {Array.from({ length: offset }, (_, i) => (
                  <div key={`pad-${i}`} aria-hidden="true" />
                ))}
                {data.days.map((d) => {
                  const events = eventsOf(d.date);
                  const b = bucket(value(d));
                  const isToday = d.date === now;
                  const future = d.date > now;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      aria-pressed={selected === d.date}
                      aria-label={`${formatDayLong(d.date)} : ${show(d)}${events.length ? `, ${events.length} évènement(s)` : ""}`}
                      onClick={() => setSelected(d.date)}
                      className={`relative flex min-h-14 flex-col overflow-hidden rounded-lg border p-1.5 text-left sm:min-h-24 sm:p-2 ${
                        selected === d.date ? "border-ink-2 bg-raised" : "border-line hover:bg-raised"
                      } ${future ? "opacity-50" : ""}`}
                    >
                      <span className={`text-[0.78rem] ${isToday ? "grid h-5 w-5 place-items-center rounded-full bg-accent font-semibold text-accent-ink" : "text-ink-2"}`}>
                        {Number(d.date.slice(8))}
                      </span>
                      <span className="tabular mt-auto hidden truncate text-[0.82rem] font-medium text-ink sm:block">{value(d) ? show(d) : ""}</span>
                      {events.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex gap-0.5" aria-hidden="true">
                          {events.some((e) => e.kind === "license_expirations") && <span className="h-1.5 w-1.5 rounded-full bg-[var(--series-2)]" />}
                          {events.some((e) => e.kind !== "license_expirations") && <span className="h-1.5 w-1.5 rounded-full bg-[var(--series-3)]" />}
                        </span>
                      )}
                      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1" style={{ background: b ? `var(--seq-${b})` : "transparent" }} />
                    </button>
                  );
                })}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted" aria-label="Légende">
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--series-2)]" /> Fin de licences
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--series-3)]" /> Taux ou prix modifié
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-5 rounded-sm" style={{ background: "linear-gradient(90deg, var(--seq-1), var(--seq-6))" }} /> Plus foncé = plus élevé
                </li>
              </ul>
            </Card>

            <Card title={day ? formatDayLong(day.date) : "Détail du jour"} subtitle={day ? undefined : "Choisissez un jour dans le calendrier."}>
              {day && (
                <div className="space-y-4 text-[0.88rem]">
                  <dl className="grid grid-cols-2 gap-3">
                    {(
                      [
                        [`Chiffre d'affaires (${ref})`, formatMoney(day.revenueTotal, ref)],
                        ["Ventes payées", formatInt(day.paidOrders)],
                        ["Inscriptions", formatInt(day.signups)],
                        ["Publications", formatInt(day.publications)],
                        ["Nouveaux abonnements", formatInt(day.newSubscriptions)],
                        ["Fins de licence", formatInt(day.licenseExpirations)],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-raised p-2.5">
                        <dt className="text-[0.75rem] text-muted">{k}</dt>
                        <dd className="tabular mt-0.5 font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    <h3 className="text-[0.82rem] font-medium text-muted">Évènements</h3>
                    {eventsOf(day.date).length ? (
                      <ul className="mt-2 space-y-1.5">
                        {eventsOf(day.date).map((e) => (
                          <li key={`${e.kind}-${e.subject}`} className="flex justify-between gap-3 rounded-lg border border-line px-2.5 py-1.5">
                            <span>
                              {EVENT_LABELS[e.kind]} · <span className="text-ink-2">{e.subject}</span>
                            </span>
                            <span className="tabular text-muted">{formatInt(e.count)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted">Aucun évènement ce jour-là.</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import type { AdminGeoResponse } from "@zaweli/shared-types";
import { useMemo, useState } from "react";
import { BarList } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { useAdmin } from "@/components/providers";
import { Card, ErrorState, Loading, MissingRates, PageHeader } from "@/components/ui";
import { WorldMap } from "@/components/world-map";
import { CONTINENT_LABELS, countryName, formatCompact, formatInt, formatMoney } from "@/lib/format";
import { toRange } from "@/lib/range";
import { useData } from "@/lib/use-data";

type Row = AdminGeoResponse["countries"][number];
const METRICS = [
  { id: "users", label: "Comptes", hint: "tous les comptes du pays" },
  { id: "newUsers", label: "Nouveaux comptes", hint: "inscrits sur la période" },
  { id: "payingUsers", label: "Clients payants", hint: "ayant payé sur la période" },
  { id: "revenueTotal", label: "Chiffre d'affaires", hint: "ventes payées sur la période, converties" },
] as const;
type Metric = (typeof METRICS)[number]["id"];
const valueOf = (r: Pick<Row, Metric>, m: Metric) => (m === "revenueTotal" ? Number(r.revenueTotal) : r[m]);

export default function MapPage() {
  const { api, period, tz } = useAdmin();
  const range = toRange(period, tz);
  const geo = useData(`geo:${JSON.stringify(range)}`, () => api.geo(range));
  const [metric, setMetric] = useState<Metric>("users");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ by: Metric | "name"; desc: boolean }>({ by: "users", desc: true });

  const data = geo.data;
  const ref = data?.referenceCurrency ?? "USD";
  const display = (r: Pick<Row, Metric>, m: Metric) => (m === "revenueTotal" ? formatMoney(r.revenueTotal, ref, { compact: true }) : formatInt(r[m]));
  const label = METRICS.find((m) => m.id === metric)!;

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.countries
      .filter((c) => !q || c.code.toLowerCase() === q || countryName(c.code).toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = sort.by === "name" ? countryName(a.code).localeCompare(countryName(b.code), "fr") : valueOf(a, sort.by) - valueOf(b, sort.by);
        return sort.desc ? -diff : diff;
      });
  }, [data, query, sort]);

  const header = (by: Metric | "name", text: string) => (
    <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap" aria-sort={sort.by === by ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ by, desc: s.by === by ? !s.desc : by !== "name" }))} className="hover:text-ink">
        {text} {sort.by === by ? (sort.desc ? "↓" : "↑") : ""}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader title="Carte du monde" description="Où sont vos utilisateurs et vos clients : par pays et par continent." actions={<PeriodFilter />} />
      {geo.error && <ErrorState message={geo.error} onRetry={geo.reload} />}
      {!data && !geo.error && <Loading />}
      {data && (
        <div className="space-y-5" data-refreshing={geo.refreshing}>
          <MissingRates currencies={metric === "revenueTotal" ? data.missingRates : []} reference={ref} />
          <Card
            title={label.label}
            subtitle={`Par pays : ${label.hint}${metric === "revenueTotal" ? ` (${ref})` : ""}.`}
            actions={
              <div role="radiogroup" aria-label="Indicateur affiché" className="flex flex-wrap gap-1 rounded-lg border border-line p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={metric === m.id}
                    onClick={() => setMetric(m.id)}
                    className={`rounded-md px-2.5 py-1 text-[0.8rem] ${metric === m.id ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-raised"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            }
          >
            <WorldMap
              metricLabel={label.label}
              values={
                new Map(
                  data.countries.map((c) => [
                    c.code,
                    {
                      value: valueOf(c, metric),
                      display: display(c, metric),
                      lines: [
                        `${formatInt(c.users)} comptes · ${formatInt(c.newUsers)} nouveaux`,
                        `${formatInt(c.paidOrders)} ventes · ${formatMoney(c.revenueTotal, ref)}`,
                      ],
                    },
                  ]),
                )
              }
            />
          </Card>

          <div className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {data.continents
              .filter((c) => c.continent !== "antarctica")
              .map((c) => (
                <div key={c.continent} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                  <p className="text-[0.82rem] text-muted">{CONTINENT_LABELS[c.continent]}</p>
                  <p className="mt-1 text-[1.4rem] font-semibold">{display(c, metric)}</p>
                  <p className="mt-1 text-[0.75rem] text-muted">
                    {formatCompact(c.users)} comptes · {formatMoney(c.revenueTotal, ref, { compact: true })}
                  </p>
                </div>
              ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card title={`Classement : ${label.label.toLowerCase()}`}>
              <BarList
                rows={[...data.countries]
                  .sort((a, b) => valueOf(b, metric) - valueOf(a, metric))
                  .filter((c) => valueOf(c, metric) > 0)
                  .slice(0, 12)
                  .map((c) => ({ key: c.code, label: countryName(c.code), value: valueOf(c, metric), display: display(c, metric) }))}
              />
              {data.unknown.users > 0 && (
                <p className="mt-3 text-[0.75rem] text-muted">
                  Pays inconnu : {formatInt(data.unknown.users)} comptes, {formatInt(data.unknown.paidOrders)} ventes.
                </p>
              )}
            </Card>

            <Card
              className="xl:col-span-2"
              title="Tous les pays"
              actions={
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un pays ou un code (CD, FR…)"
                  aria-label="Rechercher un pays"
                  className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-[0.85rem] outline-none focus:border-ink-2 sm:w-72"
                />
              }
            >
              <div className="relative max-h-[32rem] overflow-auto rounded-lg border border-line">
                <table className="tabular w-full text-[0.85rem]">
                  <thead className="sticky top-0 bg-raised text-ink-2">
                    <tr>
                      {header("name", "Pays")}
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Continent
                      </th>
                      {header("users", "Comptes")}
                      {header("newUsers", "Nouveaux")}
                      {header("payingUsers", "Payants")}
                      {header("revenueTotal", `CA (${ref})`)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.code} className="border-t border-line">
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {countryName(c.code)} <span className="text-muted">{c.code}</span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">{CONTINENT_LABELS[c.continent]}</td>
                        <td className="px-3 py-1.5">{formatInt(c.users)}</td>
                        <td className="px-3 py-1.5">{formatInt(c.newUsers)}</td>
                        <td className="px-3 py-1.5">{formatInt(c.payingUsers)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{formatMoney(c.revenueTotal, ref)}</td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted">
                          Aucun pays ne correspond.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

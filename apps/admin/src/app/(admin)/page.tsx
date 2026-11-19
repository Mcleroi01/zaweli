"use client";

import Link from "next/link";
import { BarList, ColumnChart, LinesChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { useAdmin } from "@/components/providers";
import { Card, DataTable, Delta, ErrorState, Loading, MissingRates, PageHeader, StatTile } from "@/components/ui";
import { WorldMap } from "@/components/world-map";
import { CONTINENT_LABELS, countryName, formatCompact, formatDay, formatInt, formatMoney, formatPercent } from "@/lib/format";
import { intervalFor, toRange } from "@/lib/range";
import { useData } from "@/lib/use-data";

export default function DashboardPage() {
  const { api, period, tz } = useAdmin();
  const range = toRange(period, tz);
  const interval = intervalFor(range);
  const key = JSON.stringify(range);
  const overview = useData(`overview:${key}`, () => api.overview(range));
  const series = useData(`series:${key}`, () => api.timeseries({ ...range, interval }));
  const geo = useData(`geo:${key}`, () => api.geo(range));

  const o = overview.data;
  const ref = o?.referenceCurrency ?? "USD";
  const money = (amount: string | number) => formatMoney(amount, ref, { compact: true });

  return (
    <>
      <PageHeader title="Tableau de bord" description="Activité mondiale de Zaweli sur la période choisie." actions={<PeriodFilter />} />

      {overview.error && <ErrorState message={overview.error} onRetry={overview.reload} />}
      {!o && !overview.error && <Loading />}

      {o && (
        <div className="space-y-5" data-refreshing={overview.refreshing}>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatTile label={`Chiffre d'affaires (${ref})`} value={formatMoney(o.revenue.total.amount, ref)} hint={`${formatInt(o.orders.paid)} ventes payées`}>
              <Delta current={Number(o.revenue.total.amount)} previous={Number(o.revenue.previousTotal.amount)} />
            </StatTile>
            <StatTile label="Nouveaux comptes" value={formatInt(o.users.new)} hint={`${formatInt(o.users.total)} comptes au total`}>
              <Delta current={o.users.new} previous={o.users.previousNew} />
            </StatTile>
            <StatTile label="Nouveaux abonnements" value={formatInt(o.subscriptions.newInRange)} hint={`${formatInt(o.subscriptions.active)} abonnements actifs aujourd'hui`}>
              <Delta current={o.subscriptions.newInRange} previous={o.subscriptions.previousNewInRange} />
            </StatTile>
            <StatTile label="Expériences publiées" value={formatInt(o.publications.inRange)}>
              <Delta current={o.publications.inRange} previous={o.publications.previous} />
            </StatTile>
            <StatTile
              label="Conversion gratuit → payant"
              value={o.conversion.freeUsers ? formatPercent(o.conversion.convertedUsers / o.conversion.freeUsers) : "—"}
              hint={`${formatInt(o.conversion.convertedUsers)} sur ${formatInt(o.conversion.freeUsers)} comptes (depuis le début)`}
            />
            <StatTile label="Clients payants" value={formatInt(o.payingUsers)} hint="Comptes ayant au moins un achat payé" />
            <StatTile
              label="Pays connu"
              value={o.users.total ? formatPercent(o.users.withCountry / o.users.total) : "—"}
              hint={`${formatInt(o.users.withCountry)} comptes avec un pays déclaré ou détecté`}
            />
            <StatTile label="Signalements ouverts" value={formatInt(o.reports.open)} hint={o.reports.open ? "En attente de traitement" : "Rien en attente"} />
          </div>

          <MissingRates currencies={o.revenue.total.missingRates} reference={ref} />

          <div className="grid gap-5 xl:grid-cols-5">
            <Card
              className="xl:col-span-3"
              title={`Chiffre d'affaires par ${interval === "day" ? "jour" : interval === "week" ? "semaine" : "mois"} (${ref})`}
              subtitle="Ventes payées, converties avec les taux saisis. Le détail par devise d'origine est dans l'infobulle."
              refreshing={series.refreshing}
            >
              {series.error && <ErrorState message={series.error} onRetry={series.reload} />}
              {series.data && (
                <>
                  <ColumnChart
                    data={series.data.points}
                    value={(p) => Number(p.revenueTotal)}
                    interval={interval}
                    label={`Total ${ref}`}
                    format={(n) => formatMoney(n, ref)}
                    details={(p) => Object.entries(p.revenue).map(([c, a]) => ({ label: c, value: formatMoney(a, c) }))}
                  />
                  <DataTable
                    caption="Chiffre d'affaires par période"
                    columns={["Période", `Total ${ref}`, "Ventes", ...series.data.currencies]}
                    rows={series.data.points.map((p) => [formatDay(p.date), formatMoney(p.revenueTotal, ref), formatInt(p.paidOrders), ...series.data!.currencies.map((c) => (p.revenue[c] ? formatMoney(p.revenue[c]!, c) : "—"))])}
                  />
                </>
              )}
            </Card>

            <Card className="xl:col-span-2" title="Ventes par devise d'origine" subtitle="Montants exacts, sans conversion.">
              {o.revenue.byCurrency.length ? (
                <ul className="divide-y divide-line">
                  {o.revenue.byCurrency.map((m) => (
                    <li key={m.currency} className="flex items-baseline justify-between gap-4 py-2 text-[0.9rem]">
                      <span className="text-ink-2">
                        {m.currency}
                        {o.revenue.total.missingRates.includes(m.currency) && <span className="ml-2 text-[0.75rem] text-warn">sans taux</span>}
                      </span>
                      <span className="tabular font-medium">{formatMoney(m.amount, m.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[0.85rem] text-muted">Aucune vente payée sur la période.</p>
              )}
            </Card>
          </div>

          <Card title="Inscriptions, publications et nouveaux abonnements" refreshing={series.refreshing}>
            {series.data && (
              <>
                <LinesChart
                  data={series.data.points}
                  interval={interval}
                  series={[
                    { key: "signups", label: "Inscriptions", color: "var(--series-1)", value: (p) => p.signups },
                    { key: "publications", label: "Publications", color: "var(--series-2)", value: (p) => p.publications },
                    { key: "subs", label: "Nouveaux abonnements", color: "var(--series-3)", value: (p) => p.newSubscriptions },
                  ]}
                />
                <DataTable
                  caption="Activité par période"
                  columns={["Période", "Inscriptions", "Publications", "Nouveaux abonnements"]}
                  rows={series.data.points.map((p) => [formatDay(p.date), formatInt(p.signups), formatInt(p.publications), formatInt(p.newSubscriptions)])}
                />
              </>
            )}
          </Card>

          <div className="grid gap-5 xl:grid-cols-5">
            <Card
              className="xl:col-span-3"
              title="Comptes par pays"
              subtitle="Tous les comptes, selon le pays déclaré ou détecté."
              actions={
                <Link href="/carte" className="text-[0.85rem] text-ink-2 underline-offset-4 hover:underline">
                  Carte détaillée →
                </Link>
              }
              refreshing={geo.refreshing}
            >
              {geo.error && <ErrorState message={geo.error} onRetry={geo.reload} />}
              {geo.data && (
                <WorldMap metricLabel="Comptes" values={new Map(geo.data.countries.map((c) => [c.code, { value: c.users, display: formatInt(c.users), lines: [`${formatInt(c.newUsers)} nouveaux sur la période`] }]))} />
              )}
            </Card>
            <Card className="xl:col-span-2" title="Premiers pays et continents" refreshing={geo.refreshing}>
              {geo.data && (
                <div className="space-y-6">
                  <BarList
                    rows={geo.data.countries.slice(0, 8).map((c) => ({ key: c.code, label: countryName(c.code), value: c.users, display: formatCompact(c.users), hint: `${formatInt(c.newUsers)} nouveaux · ${money(c.revenueTotal)}` }))}
                  />
                  <div>
                    <h3 className="mb-2 text-[0.82rem] font-medium text-muted">Par continent</h3>
                    <BarList
                      rows={geo.data.continents
                        .filter((c) => c.users > 0)
                        .sort((a, b) => b.users - a.users)
                        .map((c) => ({ key: c.continent, label: CONTINENT_LABELS[c.continent], value: c.users, display: formatCompact(c.users) }))}
                    />
                    {geo.data.unknown.users > 0 && <p className="mt-2 text-[0.75rem] text-muted">{formatInt(geo.data.unknown.users)} comptes sans pays connu.</p>}
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

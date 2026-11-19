"use client";

import { BarList, ColumnChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { useAdmin } from "@/components/providers";
import { Card, DataTable, ErrorState, Loading, PageHeader, StatTile } from "@/components/ui";
import { formatDateTime, formatDay, formatInt, formatPercent } from "@/lib/format";
import { intervalFor, toRange } from "@/lib/range";
import { useData } from "@/lib/use-data";

const SOURCES = { free: "Droit gratuit", purchase: "Achat", admin_grant: "Geste commercial", promotion: "Promotion" } as const;
const STATUSES = [
  ["active", "Actives"],
  ["pending", "En attente"],
  ["expired", "Expirées"],
  ["revoked", "Révoquées"],
  ["refunded", "Remboursées"],
] as const;

export default function SubscriptionsPage() {
  const { api, period, tz } = useAdmin();
  const range = toRange(period, tz);
  const interval = intervalFor(range);
  const subs = useData("subscriptions", () => api.subscriptions());
  const series = useData(`series:${JSON.stringify(range)}`, () => api.timeseries({ ...range, interval }));
  const overview = useData(`overview:${JSON.stringify(range)}`, () => api.overview(range));
  const s = subs.data;
  const paidActive = s ? s.bySource.filter((x) => x.source !== "free").reduce((n, x) => n + x.active, 0) : 0;

  return (
    <>
      <PageHeader title="Abonnements" description="Licences par formule, par origine, et celles qui arrivent à échéance." actions={<PeriodFilter />} />
      {subs.error && <ErrorState message={subs.error} onRetry={subs.reload} />}
      {!s && !subs.error && <Loading />}
      {s && (
        <div className="space-y-5" data-refreshing={subs.refreshing}>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Licences actives" value={formatInt(s.activeTotal)} hint="Toutes origines, aujourd'hui" />
            <StatTile label="Abonnements actifs (hors gratuit)" value={formatInt(paidActive)} hint="Achats, gestes commerciaux, promotions" />
            <StatTile label="Échéances sous 30 jours" value={formatInt(s.expiringSoon.length)} hint={s.expiringSoon.length >= 50 ? "50 premières affichées" : "À relancer avant la fin"} />
            <StatTile
              label="Conversion gratuit → payant"
              value={overview.data?.conversion.freeUsers ? formatPercent(overview.data.conversion.convertedUsers / overview.data.conversion.freeUsers) : "—"}
              hint="Comptes ayant eu le droit gratuit puis acheté"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Licences actives par formule">
              <BarList rows={s.byPlan.filter((p) => p.active > 0).map((p) => ({ key: p.planCode, label: p.planName, value: p.active, display: formatInt(p.active) }))} />
              <div className="relative mt-4 overflow-x-auto rounded-lg border border-line">
                <table className="tabular w-full text-[0.82rem]">
                  <thead className="bg-raised text-left text-ink-2">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Formule
                      </th>
                      {STATUSES.map(([, label]) => (
                        <th key={label} scope="col" className="px-3 py-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.byPlan.map((p) => (
                      <tr key={p.planCode} className="border-t border-line">
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {p.planName} <span className="text-muted">{p.planCode}</span>
                        </td>
                        {STATUSES.map(([key]) => (
                          <td key={key} className="px-3 py-1.5">
                            {formatInt(p[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Licences actives par origine">
              <BarList rows={s.bySource.map((x) => ({ key: x.source, label: SOURCES[x.source], value: x.active, display: formatInt(x.active) }))} />
            </Card>
          </div>

          <Card title="Nouveaux abonnements" subtitle="Licences créées sur la période, hors droit gratuit." refreshing={series.refreshing}>
            {series.error && <ErrorState message={series.error} onRetry={series.reload} />}
            {series.data && (
              <>
                <ColumnChart data={series.data.points} value={(p) => p.newSubscriptions} interval={interval} label="Nouveaux abonnements" />
                <DataTable caption="Nouveaux abonnements par période" columns={["Période", "Nouveaux abonnements"]} rows={series.data.points.map((p) => [formatDay(p.date), formatInt(p.newSubscriptions)])} />
              </>
            )}
          </Card>

          <Card title="Échéances des 30 prochains jours" subtitle="Licences actives dont la fin approche, de la plus proche à la plus lointaine.">
            {s.expiringSoon.length === 0 ? (
              <p className="py-6 text-center text-[0.85rem] text-muted">Aucune échéance dans les 30 jours.</p>
            ) : (
              <div className="relative max-h-96 overflow-auto rounded-lg border border-line">
                <table className="tabular w-full text-[0.85rem]">
                  <thead className="sticky top-0 bg-raised text-left text-ink-2">
                    <tr>
                      <th className="px-3 py-2 font-medium">Fin</th>
                      <th className="px-3 py-2 font-medium">Formule</th>
                      <th className="px-3 py-2 font-medium">Compte</th>
                      <th className="px-3 py-2 font-medium">Licence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.expiringSoon.map((l) => (
                      <tr key={l.licenseId} className="border-t border-line">
                        <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(l.endsAt, tz)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{l.planName}</td>
                        <td className="px-3 py-1.5 font-mono text-[0.75rem] text-ink-2">{l.userId}</td>
                        <td className="px-3 py-1.5 font-mono text-[0.75rem] text-ink-2">{l.licenseId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

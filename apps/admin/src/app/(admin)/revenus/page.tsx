"use client";

import { type FormEvent, useState } from "react";
import { ColumnChart } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { useAdmin } from "@/components/providers";
import { Card, DataTable, Delta, ErrorState, Loading, MissingRates, Note, PageHeader, StatTile } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { formatDateTime, formatDay, formatInt, formatMoney } from "@/lib/format";
import { intervalFor, today, toRange } from "@/lib/range";
import { useData } from "@/lib/use-data";

export default function RevenuePage() {
  const { api, period, tz } = useAdmin();
  const range = toRange(period, tz);
  const interval = intervalFor(range);
  const key = JSON.stringify(range);
  const [version, setVersion] = useState(0);
  const overview = useData(`overview:${key}:${version}`, () => api.overview(range));
  const series = useData(`series:${key}:${version}`, () => api.timeseries({ ...range, interval }));

  const o = overview.data;
  const ref = o?.referenceCurrency ?? "USD";
  const basket = o && o.orders.paid ? Number(o.revenue.total.amount) / o.orders.paid : 0;

  return (
    <>
      <PageHeader title="Revenus" description="Ventes payées, par jour et par devise. Un remboursement retire la vente du chiffre." actions={<PeriodFilter />} />
      {overview.error && <ErrorState message={overview.error} onRetry={overview.reload} />}
      {!o && !overview.error && <Loading />}
      {o && (
        <div className="space-y-5" data-refreshing={overview.refreshing}>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatTile label={`Chiffre d'affaires (${ref})`} value={formatMoney(o.revenue.total.amount, ref)}>
              <Delta current={Number(o.revenue.total.amount)} previous={Number(o.revenue.previousTotal.amount)} />
            </StatTile>
            <StatTile label="Ventes payées" value={formatInt(o.orders.paid)}>
              <Delta current={o.orders.paid} previous={o.orders.previousPaid} />
            </StatTile>
            <StatTile label={`Panier moyen (${ref})`} value={o.orders.paid ? formatMoney(basket, ref) : "—"} hint="Ventes converties seulement" />
            <StatTile label="Devises encaissées" value={formatInt(o.revenue.byCurrency.length)} hint={o.revenue.byCurrency.map((m) => m.currency).join(" · ") || "Aucune"} />
          </div>

          <MissingRates currencies={o.revenue.total.missingRates} reference={ref} />

          <Card title={`Total converti en ${ref}`} subtitle="Somme des devises qui ont un taux ce jour-là." refreshing={series.refreshing}>
            {series.error && <ErrorState message={series.error} onRetry={series.reload} />}
            {series.data && (
              <>
                <ColumnChart
                  data={series.data.points}
                  value={(p) => Number(p.revenueTotal)}
                  interval={interval}
                  label={`Total ${ref}`}
                  format={(n) => formatMoney(n, ref)}
                  details={(p) => [{ label: "Ventes", value: formatInt(p.paidOrders) }]}
                  height={280}
                />
                <DataTable
                  caption="Chiffre d'affaires par période"
                  columns={["Période", `Total ${ref}`, "Ventes", ...series.data.currencies]}
                  rows={series.data.points.map((p) => [formatDay(p.date), formatMoney(p.revenueTotal, ref), formatInt(p.paidOrders), ...series.data!.currencies.map((c) => (p.revenue[c] ? formatMoney(p.revenue[c]!, c) : "—"))])}
                />
              </>
            )}
          </Card>

          {series.data && series.data.currencies.length > 0 && (
            <div>
              <h2 className="mb-3 text-[0.95rem] font-semibold">Par devise d&apos;origine</h2>
              <p className="-mt-2 mb-3 text-[0.82rem] text-muted">Un graphique par devise : leurs échelles ne se comparent pas.</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {series.data.currencies.map((c) => {
                  const total = o.revenue.byCurrency.find((m) => m.currency === c)?.amount ?? "0";
                  return (
                    <Card key={c} title={c} subtitle={`${formatMoney(total, c)} sur la période`} refreshing={series.refreshing}>
                      <ColumnChart data={series.data!.points} value={(p) => Number(p.revenue[c] ?? 0)} interval={interval} label={c} format={(n) => formatMoney(n, c)} height={160} />
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <ExchangeRates onChange={() => setVersion((v) => v + 1)} />
        </div>
      )}
    </>
  );
}

/** Taux saisis et datés par l'équipe : la seule source des totaux convertis. */
function ExchangeRates({ onChange }: { onChange: () => void }) {
  const { api, tz } = useAdmin();
  const [nonce, setNonce] = useState(0);
  const rates = useData(`rates:${nonce}`, () => api.exchangeRates());
  const [currency, setCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [validFrom, setValidFrom] = useState(() => today(tz));
  const [newRef, setNewRef] = useState("");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = rates.data?.referenceCurrency ?? "USD";

  const run = async (work: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage({ tone: "info", text: ok });
      setNonce((n) => n + 1);
      onChange();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiRequestError || e instanceof Error ? e.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const code = currency.trim().toUpperCase();
    void run(() => api.addExchangeRate({ currency: code, rate: rate.trim().replace(",", "."), validFrom }), `Taux ${code} enregistré à partir du ${formatDay(validFrom)}.`);
  };
  const changeRef = (e: FormEvent) => {
    e.preventDefault();
    const code = newRef.trim().toUpperCase();
    void run(() => api.setReferenceCurrency(code), `Devise de référence : ${code}.`);
  };

  const field = "h-9 rounded-lg border border-line bg-canvas px-3 text-[0.85rem] outline-none focus:border-ink-2";
  return (
    <Card title="Taux de change" subtitle={`Valeur d'une unité de chaque devise en ${ref}. Un nouveau taux s'ajoute daté ; les anciens ne changent jamais.`}>
      {rates.error && <ErrorState message={rates.error} onRetry={rates.reload} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <form onSubmit={add} className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            <label className="text-[0.82rem] text-ink-2">
              Devise
              <input required value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="CDF" maxLength={3} pattern="[A-Za-z]{3}" className={`${field} mt-1 w-full uppercase`} />
            </label>
            <label className="text-[0.82rem] text-ink-2">
              1 unité = … {ref}
              <input required value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00036" inputMode="decimal" pattern="\d{1,12}([.,]\d{1,10})?" className={`${field} mt-1 w-full`} />
            </label>
            <label className="text-[0.82rem] text-ink-2">
              À partir du
              <input required type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={`${field} mt-1 w-full`} />
            </label>
            <button type="submit" disabled={busy} className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink disabled:opacity-60 min-[420px]:col-span-3 min-[420px]:w-fit">
              Ajouter le taux
            </button>
          </form>
          <form onSubmit={changeRef} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <label className="text-[0.82rem] text-ink-2">
              Devise de référence (actuelle : {ref})
              <input required value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="EUR" maxLength={3} pattern="[A-Za-z]{3}" className={`${field} mt-1 block w-28 uppercase`} />
            </label>
            <button type="submit" disabled={busy} className="h-9 rounded-lg border border-line px-4 text-[0.85rem] hover:bg-raised disabled:opacity-60">
              Changer
            </button>
            <p className="w-full text-[0.75rem] text-muted">Les taux saisis vers {ref} sont conservés, mais ne servent plus : saisissez ceux de la nouvelle référence.</p>
          </form>
          {message && <Note tone={message.tone}>{message.text}</Note>}
        </div>
        <div className="relative max-h-80 overflow-auto rounded-lg border border-line">
          <table className="tabular w-full text-[0.85rem]">
            <thead className="sticky top-0 bg-raised text-left text-ink-2">
              <tr>
                <th className="px-3 py-2 font-medium">Devise</th>
                <th className="px-3 py-2 font-medium">Taux</th>
                <th className="px-3 py-2 font-medium">À partir du</th>
                <th className="px-3 py-2 font-medium">Saisi le</th>
              </tr>
            </thead>
            <tbody>
              {(rates.data?.rates ?? []).map((r) => (
                <tr key={r.id} className={`border-t border-line ${r.referenceCurrency !== ref ? "text-muted" : ""}`}>
                  <td className="px-3 py-1.5">
                    {r.currency} → {r.referenceCurrency}
                  </td>
                  <td className="px-3 py-1.5">{Number(r.rate).toLocaleString("fr-FR", { maximumSignificantDigits: 10 })}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDay(r.validFrom)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
              {rates.data && !rates.data.rates.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    Aucun taux saisi : seules les ventes en {ref} entrent dans les totaux.
                  </td>
                </tr>
              )}
              {!rates.data && !rates.error && (
                <tr>
                  <td colSpan={4}>
                    <Loading />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

"use client";

import type { AdminPaymentSettingsRequest, AdminPaymentSettingsResponse, RewardTier } from "@zaweli/shared-types";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, DataTable, ErrorState, Loading, Note, PageHeader, StatTile } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { formatDateTime, formatInt, formatMoney } from "@/lib/format";
import { useData } from "@/lib/use-data";

const field = "h-9 rounded-lg border border-line bg-canvas px-3 text-[0.85rem] outline-none focus:border-ink-2";
const pct = (rate: string | null) => (rate ? `${Math.round(Number(rate) * 10000) / 100} %` : "—");
/** « 4 » ou « 4,5 » (pour cent) → « 0.04 » / « 0.045 » ; vide → null. */
const toRate = (value: string): string | null => {
  const v = value.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("Pourcentage entre 0 et 100 attendu.");
  return String(Math.round(n * 10000) / 1_000_000);
};
const ORDER_STATUS: Record<string, string> = { pending: "En attente", paid: "Payée", failed: "Échouée", cancelled: "Annulée", expired: "Expirée", refunded: "Remboursée", disputed: "À vérifier" };
const TRANSFER_STATUS: Record<string, string> = { initiated: "Créé", pending: "En attente", succeeded: "Confirmé", failed: "Échoué", cancelled: "Annulé", refunded: "Remboursé" };

export default function PaymentsPage() {
  const { api } = useAdmin();
  const [version, setVersion] = useState(0);
  const settings = useData(`pay-settings:${version}`, () => api.paymentSettings());
  const orders = useData(`pay-orders:${version}`, () => api.paymentOrders());
  const transfers = useData(`pay-transfers:${version}`, () => api.paymentTransfers());
  const referrers = useData(`pay-referrers:${version}`, () => api.referrers());
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reconcile = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.reconcilePayments();
      setMessage({ tone: "info", text: `${formatInt(r.checked)} paiement(s) revérifié(s) chez MbiyoPay, ${formatInt(r.settled)} mis à jour.` });
      setVersion((v) => v + 1);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Revérification impossible." });
    }
    setBusy(false);
  };

  const o = orders.data ?? [];
  const pending = o.filter((x) => x.status === "pending").length;
  const disputed = o.filter((x) => x.status === "disputed").length;

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Mobile money (MbiyoPay), cadeaux d'argent et parrainage. Rien n'est payé sans confirmation relue chez MbiyoPay."
        actions={
          <button type="button" onClick={reconcile} disabled={busy} className="h-9 rounded-lg border border-line px-4 text-[0.85rem] hover:bg-raised disabled:opacity-60">
            Revérifier les paiements en attente
          </button>
        }
      />
      {message && <Note tone={message.tone}>{message.text}</Note>}
      {settings.error && <ErrorState message={settings.error} onRetry={settings.reload} />}
      {!settings.data && !settings.error && <Loading />}
      {settings.data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Passerelle" value={settings.data.mode === "live" ? "Réel" : settings.data.mode === "sandbox" ? "Sandbox (test)" : "Désactivée"} hint="Selon la clé MbiyoPay de l'API" />
            <StatTile label="Commandes en attente" value={formatInt(pending)} hint="Sur les 50 dernières" />
            <StatTile label="À vérifier" value={formatInt(disputed)} hint="Montant reçu différent du prix" />
            <StatTile label="Transferts des cadeaux" value={settings.data.moneyTransfersEnabled ? "Ouverts" : "Fermés"} hint={`Frais : ${pct(settings.data.moneyFeeRate)}`} />
          </div>
          {!settings.data.webhookUrl && settings.data.mode !== "disabled" && (
            <Note tone="warn">PUBLIC_API_URL n&apos;est pas réglée : MbiyoPay ne peut pas envoyer ses webhooks, et les envois d&apos;argent aux destinataires sont impossibles.</Note>
          )}
          {settings.data.webhookUrl && (
            <Note tone="info">
              URL du webhook à saisir dans MbiyoPay (Paramètres → Webhooks) : <span className="font-mono">{settings.data.webhookUrl}</span>
            </Note>
          )}
          <SettingsForm settings={settings.data} onSaved={() => setVersion((v) => v + 1)} />

          <Card title="Commandes" subtitle="Les 50 plus récentes. « Carte » : part payée par carte cadeau ; « Réduction » : réduction de filleul.">
            {orders.error && <ErrorState message={orders.error} onRetry={orders.reload} />}
            {orders.data && (
              <DataTable
                caption="Commandes"
                open
                empty="Aucune commande pour l'instant."
                columns={["Date", "Formule", "Statut", "Prix", "Réduction", "Carte", "Payé (mobile money)", "Pays", "Réf. MbiyoPay"]}
                rows={o.map((r) => [
                  formatDateTime(r.createdAt),
                  r.plan,
                  ORDER_STATUS[r.status] ?? r.status,
                  formatMoney(r.listAmount ?? r.amount, r.currency),
                  Number(r.discountAmount) ? formatMoney(r.discountAmount, r.currency) : "—",
                  Number(r.creditAmount) ? formatMoney(r.creditAmount, r.currency) : "—",
                  formatMoney(r.amount, r.currency),
                  r.countryCode ?? "—",
                  r.providerRef ?? "—",
                ])}
              />
            )}
          </Card>

          <Card title="Transferts des cadeaux d'argent" subtitle="Paiement de l'expéditeur (encaissement) puis envoi au destinataire. Seuls les 4 derniers chiffres du numéro sont conservés.">
            {transfers.error && <ErrorState message={transfers.error} onRetry={transfers.reload} />}
            {transfers.data && (
              <DataTable
                caption="Transferts"
                open
                empty="Aucun transfert : les cadeaux d'argent via Zaweli apparaîtront ici."
                columns={["Date", "Sens", "Statut", "Montant", "Frais", "Réseau", "Numéro", "Cadeau", "Motif d'échec"]}
                rows={transfers.data.map((r) => [
                  formatDateTime(r.createdAt),
                  r.direction === "funding" ? "Encaissement" : "Envoi",
                  TRANSFER_STATUS[r.status] ?? r.status,
                  formatMoney(r.amount, r.currency),
                  formatMoney(r.fee, r.currency),
                  `${r.network} (${r.countryCode})`,
                  `…${r.phoneLast4}`,
                  r.giftStatus ?? "—",
                  r.failureReason ?? "—",
                ])}
              />
            )}
          </Card>

          <Card title="Parrains" subtitle="Filleuls actifs = inscrits par le lien et ayant payé leur première formule.">
            {referrers.error && <ErrorState message={referrers.error} onRetry={referrers.reload} />}
            {referrers.data && (
              <DataTable
                caption="Parrains"
                open
                empty="Aucun filleul inscrit par un lien de parrainage pour l'instant."
                columns={["Parrain", "Code", "Filleuls actifs", "En attente", "Cartes cadeaux"]}
                rows={referrers.data.map((r) => [r.displayName ?? r.referrerId.slice(0, 8), r.code ?? "—", formatInt(r.qualified), formatInt(r.pending), formatInt(r.cardsGranted)])}
              />
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function SettingsForm({ settings, onSaved }: { settings: AdminPaymentSettingsResponse; onSaved: () => void }) {
  const { api } = useAdmin();
  const [fee, setFee] = useState(settings.moneyFeeRate ? String(Number(settings.moneyFeeRate) * 100) : "");
  const [enabled, setEnabled] = useState(settings.moneyTransfersEnabled);
  const [discount, setDiscount] = useState(settings.refereeDiscountRate ? String(Number(settings.refereeDiscountRate) * 100) : "");
  const [tiers, setTiers] = useState<RewardTier[]>(settings.rewardTiers);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    let body: AdminPaymentSettingsRequest;
    try {
      body = {
        moneyFeeRate: toRate(fee),
        moneyTransfersEnabled: enabled,
        refereeDiscountRate: toRate(discount),
        rewardTiers: tiers.map((t) => ({ threshold: Number(t.threshold), amount: Number(t.amount.replace(",", ".")).toFixed(2), currency: t.currency.trim().toUpperCase() })),
      };
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
      return;
    }
    setBusy(true);
    try {
      await api.updatePaymentSettings(body);
      setMessage({ tone: "info", text: "Réglages enregistrés et journalisés." });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiRequestError || err instanceof Error ? err.message : "Enregistrement impossible." });
    }
    setBusy(false);
  };

  const setTier = (i: number, patch: Partial<RewardTier>) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Card title="Réglages" subtitle="Valeurs commerciales décidées par l'équipe : rien n'est fixé par défaut, sauf les paliers demandés (25 et 50 filleuls).">
      <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-[0.9rem] font-medium">Cadeaux d&apos;argent via Zaweli</legend>
          <label className="block text-[0.82rem] text-ink-2">
            Frais facturés à l&apos;expéditeur (%)
            <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="ex. 4" className={`${field} mt-1 block w-32`} />
          </label>
          <p className="text-[0.75rem] text-muted">Doit couvrir les frais de collecte et d&apos;envoi de MbiyoPay (voir leur tableau de bord). Vide : paiement des cadeaux impossible.</p>
          <label className="flex items-center gap-2 text-[0.85rem]">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
            Proposer le transfert via Zaweli aux clients
          </label>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-[0.9rem] font-medium">Parrainage</legend>
          <label className="block text-[0.82rem] text-ink-2">
            Réduction du filleul sur sa 1re formule (%)
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="ex. 20" className={`${field} mt-1 block w-32`} />
          </label>
          <div className="space-y-2">
            <p className="text-[0.82rem] text-ink-2">Paliers (filleuls actifs → carte cadeau)</p>
            {tiers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input aria-label="Seuil" value={t.threshold} onChange={(e) => setTier(i, { threshold: Number(e.target.value) || 0 })} inputMode="numeric" className={`${field} w-20`} />
                <span className="text-[0.82rem] text-muted">filleuls →</span>
                <input aria-label="Montant" value={t.amount} onChange={(e) => setTier(i, { amount: e.target.value })} inputMode="decimal" className={`${field} w-24`} />
                <input aria-label="Devise" value={t.currency} onChange={(e) => setTier(i, { currency: e.target.value })} maxLength={3} className={`${field} w-20 uppercase`} />
                <button type="button" onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))} className="text-[0.82rem] text-muted underline">
                  Retirer
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTiers((ts) => [...ts, { threshold: (ts.at(-1)?.threshold ?? 0) + 25, amount: "5.00", currency: "USD" }])}
              className="text-[0.82rem] underline"
            >
              Ajouter un palier
            </button>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button type="submit" disabled={busy} className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink disabled:opacity-60">
            Enregistrer
          </button>
          {message && <Note tone={message.tone}>{message.text}</Note>}
        </div>
      </form>
    </Card>
  );
}

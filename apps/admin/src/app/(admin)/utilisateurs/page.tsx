"use client";

import type { AdminUserDetail } from "@zaweli/shared-types";
import { type FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, DataTable, ErrorState, Loading, Note, PageHeader } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { formatDateTime, formatInt, formatMoney } from "@/lib/format";
import { useData } from "@/lib/use-data";

const field = "h-9 rounded-lg border border-line bg-canvas px-3 text-[0.85rem] outline-none focus:border-ink-2";
const errorText = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Action impossible.");
const LICENSE: Record<string, string> = { active: "Active", pending: "En attente", expired: "Expirée", revoked: "Retirée", refunded: "Remboursée" };
const SOURCE: Record<string, string> = { free: "Gratuite", purchase: "Achat", admin_grant: "Offerte", promotion: "Promotion" };

/** Comptes : recherche, fiche, suspension, licences offertes ou retirées (§11.9). */
export default function UsersPage() {
  const { api } = useAdmin();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<"all" | "suspended">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const list = useData(`users:${term}:${status}:${version}`, () => api.users(term, status));

  return (
    <>
      <PageHeader title="Utilisateurs" description="Recherche par adresse, nom, identifiant ou code de parrainage. Chaque action est journalisée." />
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <label className="text-[0.82rem] text-ink-2">
          Rechercher
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="adresse, nom, identifiant…" className={`${field} mt-1 block w-72 max-w-full`} />
        </label>
        <label className="text-[0.82rem] text-ink-2">
          Comptes
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${field} mt-1 block`}>
            <option value="all">Tous</option>
            <option value="suspended">Suspendus</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink">
          Chercher
        </button>
      </form>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title="Comptes" subtitle="Les 50 plus récents correspondant à la recherche.">
          {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
          {!list.data && !list.error && <Loading />}
          {list.data && list.data.length === 0 && <p className="py-4 text-[0.85rem] text-muted">Aucun compte.</p>}
          {list.data && list.data.length > 0 && (
            <ul className="divide-y divide-line">
              {list.data.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(u.id)}
                    aria-current={selected === u.id}
                    className={`flex w-full flex-wrap items-baseline justify-between gap-2 px-2 py-2.5 text-left text-[0.85rem] hover:bg-raised ${selected === u.id ? "bg-raised" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.email ?? "—"}</span>
                      <span className="block text-[0.78rem] text-muted">
                        {u.displayName ?? "Sans nom"} · {u.countryCode ?? "pays ?"} · {formatInt(u.experiences)} exp. · {formatInt(u.paidOrders)} achat(s)
                      </span>
                    </span>
                    <span className="flex gap-1.5 text-[0.75rem]">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded bg-ink/10 px-1.5 py-0.5">
                          {r}
                        </span>
                      ))}
                      {u.suspendedAt && <span className="rounded bg-danger/15 px-1.5 py-0.5 text-danger">suspendu</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {selected ? <UserCard id={selected} onChanged={() => setVersion((v) => v + 1)} /> : <Card title="Fiche">{<p className="py-4 text-[0.85rem] text-muted">Choisissez un compte.</p>}</Card>}
      </div>
    </>
  );
}

function UserCard({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { api } = useAdmin();
  const [nonce, setNonce] = useState(0);
  const detail = useData(`user:${id}:${nonce}`, () => api.user(id));
  const plans = useData("plans-for-grant", () => api.plans());
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [grantPlan, setGrantPlan] = useState("");
  const [grantReason, setGrantReason] = useState("");

  useEffect(() => {
    queueMicrotask(() => setMessage(null));
  }, [id]);

  const run = async (work: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage({ tone: "info", text: ok });
      setNonce((n) => n + 1);
      onChanged();
    } catch (e) {
      setMessage({ tone: "error", text: errorText(e) });
    }
    setBusy(false);
  };

  const u: AdminUserDetail | null = detail.data;
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!u) return <Loading />;
  const payable = (plans.data ?? []).filter((p) => !p.is_free);

  return (
    <Card title={u.email ?? u.id} subtitle={`Inscrit le ${formatDateTime(u.createdAt)} · ${u.locale.toUpperCase()} · ${u.countryCode ?? "pays inconnu"}${u.referralCode ? ` · parrainage ${u.referralCode}` : ""}`}>
      <div className="space-y-6">
        {u.deletedAt && <Note tone="warn">Compte supprimé le {formatDateTime(u.deletedAt)} (anonymisé).</Note>}
        {u.suspendedAt ? (
          <div className="space-y-2">
            <Note tone="warn">
              Suspendu le {formatDateTime(u.suspendedAt)} : {u.suspensionReason}
            </Note>
            <button type="button" disabled={busy} onClick={() => void run(() => api.unsuspendUser(u.id), "Compte rétabli.")} className="h-9 rounded-lg border border-line px-4 text-[0.85rem] hover:bg-raised">
              Rétablir le compte
            </button>
          </div>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(() => api.suspendUser(u.id, reason.trim()), "Compte suspendu : connexion bloquée et jetons refusés.");
            }}
          >
            <label className="min-w-0 flex-1 text-[0.82rem] text-ink-2">
              Motif de suspension (interne)
              <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required className={`${field} mt-1 block w-full`} />
            </label>
            <button type="submit" disabled={busy || reason.trim().length < 3} className="h-9 rounded-lg border border-danger/40 px-4 text-[0.85rem] text-danger hover:bg-danger/10 disabled:opacity-50">
              Suspendre
            </button>
          </form>
        )}

        <section>
          <h3 className="mb-2 text-[0.9rem] font-medium">Licences</h3>
          <DataTable
            caption="Licences"
            open
            empty="Aucune licence."
            columns={["Formule", "Source", "Statut", "Créations", "IA", "Fin", ""]}
            rows={u.licenses.map((l) => [
              l.plan,
              SOURCE[l.source] ?? l.source,
              LICENSE[l.status] ?? l.status,
              `${l.publications.used} / ${l.publications.max ?? "∞"}`,
              `${l.ai.used} / ${l.ai.max}`,
              l.endsAt ? formatDateTime(l.endsAt) : "—",
              l.status === "active" || l.status === "pending" ? (
                <button
                  key={l.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const why = window.prompt("Motif du retrait (journalisé) :");
                    if (why && why.trim().length >= 3) void run(() => api.revokeLicense(l.id, why.trim()), "Licence retirée.");
                  }}
                  className="text-[0.8rem] text-danger underline"
                >
                  Retirer
                </button>
              ) : (
                ""
              ),
            ])}
          />
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(() => api.grantLicense(u.id, grantPlan, grantReason.trim()), "Licence offerte.");
            }}
          >
            <label className="text-[0.82rem] text-ink-2">
              Offrir une licence
              <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} required className={`${field} mt-1 block`}>
                <option value="">Formule…</option>
                {payable.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-[0.82rem] text-ink-2">
              Motif
              <input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} required minLength={1} maxLength={300} placeholder="geste commercial, partenariat…" className={`${field} mt-1 block w-full`} />
            </label>
            <button type="submit" disabled={busy || !grantPlan || !grantReason.trim()} className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink disabled:opacity-60">
              Offrir
            </button>
          </form>
        </section>

        <section>
          <h3 className="mb-2 text-[0.9rem] font-medium">Achats</h3>
          <DataTable
            caption="Achats"
            open
            empty="Aucun achat."
            columns={["Date", "Formule", "Statut", "Montant"]}
            rows={u.orders.map((o) => [formatDateTime(o.createdAt), o.plan, o.status, formatMoney(o.amount, o.currency)])}
          />
        </section>

        <section>
          <h3 className="mb-2 text-[0.9rem] font-medium">Expériences</h3>
          <DataTable
            caption="Expériences"
            open
            empty="Aucune expérience."
            columns={["Pour", "Modèle", "Statut", "Lien", "Modifiée"]}
            rows={u.experienceList.map((e) => [e.title ?? e.recipient, e.template, e.status, e.slug ?? "—", formatDateTime(e.updatedAt)])}
          />
        </section>
        {message && <Note tone={message.tone === "error" ? "error" : "info"}>{message.text}</Note>}
      </div>
    </Card>
  );
}

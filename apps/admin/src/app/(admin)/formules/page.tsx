"use client";

import type { AdminPlanRow } from "@zaweli/shared-types";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, ErrorState, Loading, Note, PageHeader } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useData } from "@/lib/use-data";

const field = "h-9 rounded-lg border border-line bg-canvas px-3 text-[0.85rem] outline-none focus:border-ink-2";
const errorText = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Action impossible.");
const START: Record<string, string> = { on_payment_confirmed: "Au paiement", on_first_publication: "À la 1re publication", immediate: "Tout de suite" };
const EDIT: Record<string, string> = { while_valid: "Tant que la licence est valide", days: "Pendant N jours", never: "Jamais" };

/** Nombre facultatif : vide → null. */
const num = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Formules et prix (§8.3, §11.9). Une modification ne change que les champs
 * touchés ; les licences déjà vendues gardent leurs règles. Un nouveau prix
 * clôt l'ancien dans la même devise, l'historique reste.
 */
export default function PlansPage() {
  const { api } = useAdmin();
  const [version, setVersion] = useState(0);
  const plans = useData(`plans:${version}`, () => api.plans());
  const [open, setOpen] = useState<string | null>(null);
  const refresh = () => setVersion((v) => v + 1);

  return (
    <>
      <PageHeader title="Formules et prix" description="Les licences déjà vendues ont copié les règles de leur formule : les modifier ici ne les change pas." />
      {plans.error && <ErrorState message={plans.error} onRetry={plans.reload} />}
      {!plans.data && !plans.error && <Loading />}
      <div className="space-y-4">
        {plans.data?.map((p) => (
          <Card
            key={p.code}
            title={`${p.name} · ${p.code}`}
            subtitle={[p.is_free ? "Gratuite" : null, p.is_active ? "active" : "inactive", p.is_public ? "publique" : "cachée", p.duration_days ? `${p.duration_days} j` : "sans durée"].filter(Boolean).join(" · ")}
            actions={
              <button type="button" onClick={() => setOpen(open === p.code ? null : p.code)} className="h-8 rounded-lg border border-line px-3 text-[0.8rem] hover:bg-raised">
                {open === p.code ? "Fermer" : "Modifier"}
              </button>
            }
          >
            <Prices plan={p} />
            {open === p.code && <PlanForm plan={p} onSaved={refresh} />}
          </Card>
        ))}
        <NewPlan onCreated={refresh} />
      </div>
    </>
  );
}

function Prices({ plan }: { plan: AdminPlanRow }) {
  const { api } = useAdmin();
  const [prices, setPrices] = useState(plan.prices);
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const open = prices.filter((x) => !x.valid_to);
  if (plan.is_free) return <p className="text-[0.85rem] text-muted">Formule gratuite : pas de prix.</p>;
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const code = currency.trim().toUpperCase();
      const value = amount.trim().replace(",", ".");
      await api.setPrice(plan.code, code, value);
      const now = new Date().toISOString();
      setPrices((ps) => [...ps.map((x) => (x.currency === code && !x.valid_to ? { ...x, valid_to: now } : x)), { plan_id: plan.id, currency: code, amount: value, valid_from: now, valid_to: null }]);
      setAmount("");
      setMessage({ tone: "info", text: `Prix ${code} enregistré.` });
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-[0.88rem]">
        Prix en vigueur : {open.length ? open.map((x) => formatMoney(x.amount, x.currency)).join(" · ") : <span className="text-muted">aucun (la formule ne peut pas être achetée)</span>}
      </p>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <label className="text-[0.82rem] text-ink-2">
          Devise
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} pattern="[A-Za-z]{3}" className={`${field} mt-1 block w-20 uppercase`} />
        </label>
        <label className="text-[0.82rem] text-ink-2">
          Nouveau prix
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" pattern="\d{1,16}([.,]\d{1,2})?" required className={`${field} mt-1 block w-32`} />
        </label>
        <button type="submit" className="h-9 rounded-lg border border-line px-4 text-[0.85rem] hover:bg-raised">
          Enregistrer le prix
        </button>
      </form>
      {prices.some((x) => x.valid_to) && (
        <details className="text-[0.8rem] text-muted">
          <summary className="cursor-pointer">Historique des prix</summary>
          <ul className="mt-1 space-y-0.5">
            {prices
              .filter((x) => x.valid_to)
              .map((x) => (
                <li key={`${x.currency}${x.valid_from}`}>
                  {formatMoney(x.amount, x.currency)} · du {formatDateTime(x.valid_from)} au {formatDateTime(x.valid_to!)}
                </li>
              ))}
          </ul>
        </details>
      )}
      {message && <Note tone={message.tone === "error" ? "error" : "info"}>{message.text}</Note>}
    </div>
  );
}

type Draft = Record<string, string | boolean>;

const toDraft = (p: AdminPlanRow): Draft => ({
  name: p.name,
  description: p.description ?? "",
  isActive: p.is_active,
  isPublic: p.is_public,
  position: String(p.position),
  durationDays: p.duration_days?.toString() ?? "",
  startPolicy: p.start_policy,
  publicationsMax: p.publications_max?.toString() ?? "",
  recipientsMax: p.recipients_max?.toString() ?? "",
  aiGenerationsMax: String(p.ai_generations_max),
  templateAccessTag: p.template_access_tag ?? "",
  editPolicy: p.edit_policy,
  editDays: p.edit_days?.toString() ?? "",
  maxPublicationsPerDay: String(p.max_publications_per_day),
});

/** Valeur envoyée à l'API pour un champ du formulaire. */
function value(key: string, v: string | boolean): unknown {
  if (typeof v === "boolean") return v;
  if (["position", "aiGenerationsMax", "maxPublicationsPerDay"].includes(key)) return Number(v);
  if (["durationDays", "publicationsMax", "recipientsMax", "editDays"].includes(key)) return num(v);
  if (key === "description" || key === "templateAccessTag") return v.trim() === "" ? null : v.trim();
  return v;
}

function PlanFields({ draft, set, free }: { draft: Draft; set: (k: string, v: string | boolean) => void; free: boolean }) {
  const text = (k: string, label: string, props: Record<string, unknown> = {}) => (
    <label className="text-[0.82rem] text-ink-2">
      {label}
      <input value={draft[k] as string} onChange={(e) => set(k, e.target.value)} className={`${field} mt-1 block w-full`} {...props} />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {text("name", "Nom", { required: true, maxLength: 80 })}
      {text("description", "Description", { maxLength: 500 })}
      {text("position", "Ordre d'affichage", { inputMode: "numeric" })}
      {!free && text("durationDays", "Durée (jours, vide = sans fin)", { inputMode: "numeric" })}
      {text("publicationsMax", "Créations (vide = illimité)", { inputMode: "numeric" })}
      {text("recipientsMax", "Destinataires (vide = illimité)", { inputMode: "numeric" })}
      {text("aiGenerationsMax", "Suggestions IA", { inputMode: "numeric" })}
      {text("maxPublicationsPerDay", "Publications par jour (anti-abus)", { inputMode: "numeric" })}
      {text("templateAccessTag", "Modèles : étiquette (vide = tous)", { pattern: "[a-z0-9-]{2,40}" })}
      <label className="text-[0.82rem] text-ink-2">
        Démarrage
        <select value={draft.startPolicy as string} onChange={(e) => set("startPolicy", e.target.value)} className={`${field} mt-1 block w-full`}>
          {Object.entries(START).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[0.82rem] text-ink-2">
        Modification après publication
        <select value={draft.editPolicy as string} onChange={(e) => set("editPolicy", e.target.value)} className={`${field} mt-1 block w-full`}>
          {Object.entries(EDIT).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {draft.editPolicy === "days" && text("editDays", "Jours de modification", { inputMode: "numeric", required: true })}
      <label className="flex items-center gap-2 text-[0.85rem]">
        <input type="checkbox" checked={draft.isActive as boolean} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4" /> Active (achetable)
      </label>
      <label className="flex items-center gap-2 text-[0.85rem]">
        <input type="checkbox" checked={draft.isPublic as boolean} onChange={(e) => set("isPublic", e.target.checked)} className="h-4 w-4" /> Publique (affichée)
      </label>
    </div>
  );
}

function PlanForm({ plan, onSaved }: { plan: AdminPlanRow; onSaved: () => void }) {
  const { api } = useAdmin();
  const initial = toDraft(plan);
  const [draft, setDraft] = useState<Draft>(initial);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const changed = Object.keys(draft).filter((k) => draft[k] !== initial[k]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      // Seuls les champs touchés partent : les autres ne bougent pas.
      await api.updatePlan(plan.code, Object.fromEntries(changed.map((k) => [k, value(k, draft[k]!)])));
      setMessage({ tone: "info", text: `Formule enregistrée (${changed.length} champ${changed.length > 1 ? "s" : ""}).` });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    }
  };
  return (
    <form onSubmit={save} className="mt-5 space-y-4 border-t border-line pt-5">
      <PlanFields draft={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} free={plan.is_free} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={changed.length === 0} className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink disabled:opacity-50">
          Enregistrer
        </button>
        <span className="text-[0.8rem] text-muted">{changed.length ? `${changed.length} champ(s) modifié(s)` : "Aucun changement"}</span>
      </div>
      {message && <Note tone={message.tone === "error" ? "error" : "info"}>{message.text}</Note>}
    </form>
  );
}

function NewPlan({ onCreated }: { onCreated: () => void }) {
  const { api } = useAdmin();
  const blank: Draft = {
    code: "",
    name: "",
    description: "",
    isActive: false,
    isPublic: false,
    position: "0",
    durationDays: "",
    startPolicy: "on_payment_confirmed",
    publicationsMax: "",
    recipientsMax: "",
    aiGenerationsMax: "0",
    templateAccessTag: "",
    editPolicy: "while_valid",
    editDays: "",
    maxPublicationsPerDay: "20",
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg border border-line px-4 text-[0.85rem] hover:bg-raised">
        + Nouvelle formule
      </button>
    );
  }
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const body = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, k === "code" ? String(v).trim().toUpperCase() : value(k, v)]));
      await api.createPlan(body as never);
      setDraft(blank);
      setOpen(false);
      onCreated();
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err) });
    }
  };
  return (
    <Card title="Nouvelle formule" subtitle="Créée inactive et cachée par défaut ; ajoutez un prix avant de l'activer.">
      <form onSubmit={create} className="space-y-4">
        <label className="block text-[0.82rem] text-ink-2">
          Code (majuscules, ex. FAMILLE)
          <input value={draft.code as string} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} required pattern="[A-Za-z][A-Za-z0-9_]{1,31}" className={`${field} mt-1 block w-48 uppercase`} />
        </label>
        <PlanFields draft={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} free={false} />
        <div className="flex gap-2">
          <button type="submit" className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink">
            Créer
          </button>
          <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-line px-4 text-[0.85rem]">
            Annuler
          </button>
        </div>
        {message && <Note tone="error">{message.text}</Note>}
      </form>
    </Card>
  );
}

"use client";

import type { AdminTemplateRow } from "@zaweli/shared-types";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, ErrorState, Loading, Note, PageHeader } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { formatDateTime, formatInt } from "@/lib/format";
import { useData } from "@/lib/use-data";

const field = "h-9 rounded-lg border border-line bg-canvas px-3 text-[0.85rem] outline-none focus:border-ink-2";
const STATUS: Record<AdminTemplateRow["status"], string> = {
  draft: "Brouillon (invisible)",
  published: "Publié (proposé aux clients)",
  hidden: "Caché (plus proposé, expériences existantes intactes)",
  retired: "Retiré",
};

/**
 * Modèles (§7.3, §11.9) : statut, ordre et étiquettes d'accès. Le design et
 * le code d'un modèle ne s'éditent jamais ici : ils viennent du dépôt.
 */
export default function TemplatesPage() {
  const { api } = useAdmin();
  const [version, setVersion] = useState(0);
  const templates = useData(`templates:${version}`, () => api.templates());
  return (
    <>
      <PageHeader title="Modèles" description="Statut, ordre d'affichage et étiquettes d'accès (une formule « étiquetée » ne donne accès qu'aux modèles qui portent son étiquette)." />
      {templates.error && <ErrorState message={templates.error} onRetry={templates.reload} />}
      {!templates.data && !templates.error && <Loading />}
      {templates.data?.length === 0 && <Note tone="info">Aucun modèle en base : ils sont ajoutés au déploiement (pnpm templates:sync).</Note>}
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.data?.map((t) => (
          <TemplateCard key={t.slug} template={t} onSaved={() => setVersion((v) => v + 1)} />
        ))}
      </div>
    </>
  );
}

function TemplateCard({ template: t, onSaved }: { template: AdminTemplateRow; onSaved: () => void }) {
  const { api } = useAdmin();
  const [status, setStatus] = useState(t.status);
  const [position, setPosition] = useState(String(t.position));
  const [tags, setTags] = useState(t.accessTags.join(", "));
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const accessTags = tags
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    try {
      await api.updateTemplate(t.slug, { status, position: Number(position) || 0, accessTags });
      setMessage({ tone: "info", text: "Modèle enregistré." });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiRequestError || err instanceof Error ? err.message : "Action impossible." });
    }
  };
  return (
    <Card title={`${t.name} · ${t.slug}`} subtitle={`${t.category ?? "sans catégorie"} · version courante ${t.currentVersion ?? "—"} · ${formatInt(t.experiences)} expérience(s), ${formatInt(t.published)} publiée(s)`}>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-[0.82rem] text-ink-2">
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value as AdminTemplateRow["status"])} className={`${field} mt-1 block w-full`}>
            {Object.entries(STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="text-[0.82rem] text-ink-2">
            Ordre
            <input value={position} onChange={(e) => setPosition(e.target.value)} inputMode="numeric" className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-[0.82rem] text-ink-2">
            Étiquettes d&apos;accès (séparées par des virgules)
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="free-eligible, solo" className={`${field} mt-1 block w-full`} />
          </label>
        </div>
        <button type="submit" className="h-9 rounded-lg bg-accent px-4 text-[0.85rem] text-accent-ink">
          Enregistrer
        </button>
        {message && <Note tone={message.tone === "error" ? "error" : "info"}>{message.text}</Note>}
      </form>
      <details className="mt-4 text-[0.8rem] text-muted">
        <summary className="cursor-pointer">Versions ({t.versions.length})</summary>
        <ul className="mt-1 space-y-0.5">
          {t.versions.map((v) => (
            <li key={v.version}>
              {v.version} · {v.status}
              {v.publishedAt ? ` · publiée le ${formatDateTime(v.publishedAt)}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

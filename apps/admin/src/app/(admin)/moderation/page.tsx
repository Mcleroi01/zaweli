"use client";

import { useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, ErrorState, Loading, Note, PageHeader } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useData } from "@/lib/use-data";

/** Adresse publique du site (lien vers l'expérience signalée). */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zaweli.store").replace(/[\s/.]+$/, "");
const REASON: Record<string, string> = {
  harassment: "Harcèlement",
  impersonation: "Usurpation d'identité",
  scam: "Arnaque",
  hateful: "Haine",
  sexual: "Contenu sexuel",
  copyright: "Droits d'auteur",
  privacy: "Vie privée",
  other: "Autre",
};
const TABS = { open: "À traiter", actioned: "Retirés", dismissed: "Classés" } as const;

/**
 * Modération (§7.6, §11.5) : signalements reçus depuis les pages publiques,
 * retrait d'une expérience (le destinataire voit « plus disponible ») et
 * rétablissement. Chaque décision est journalisée.
 */
export default function ModerationPage() {
  const { api } = useAdmin();
  const [tab, setTab] = useState<keyof typeof TABS>("open");
  const [version, setVersion] = useState(0);
  const reports = useData(`reports:${tab}:${version}`, () => api.reports(tab));
  const suspended = useData(`suspended:${version}`, () => api.suspendedExperiences());
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const run = async (work: () => Promise<unknown>, ok: string) => {
    setMessage(null);
    try {
      await work();
      setMessage({ tone: "info", text: ok });
      setVersion((v) => v + 1);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiRequestError || e instanceof Error ? e.message : "Action impossible." });
    }
  };

  return (
    <>
      <PageHeader title="Modération" description="Signalements des destinataires et expériences retirées. Le contenu n'est jamais modifié : on le retire ou on le laisse." />
      {message && <Note tone={message.tone === "error" ? "error" : "info"}>{message.text}</Note>}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Signalements">
        {(Object.keys(TABS) as Array<keyof typeof TABS>).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={`h-9 rounded-full border px-4 text-[0.85rem] ${tab === k ? "border-ink bg-ink text-canvas" : "border-line hover:bg-raised"}`}
          >
            {TABS[k]}
          </button>
        ))}
      </div>
      <div className="space-y-5">
        <Card title={`Signalements · ${TABS[tab]}`} subtitle="Les 200 premiers, du plus ancien au plus récent.">
          {reports.error && <ErrorState message={reports.error} onRetry={reports.reload} />}
          {!reports.data && !reports.error && <Loading />}
          {reports.data?.length === 0 && <p className="py-4 text-[0.85rem] text-muted">Aucun signalement.</p>}
          <ul className="divide-y divide-line">
            {reports.data?.map((r) => (
              <li key={r.id} className="space-y-2 py-3 text-[0.85rem]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <span className="font-medium">{REASON[r.reason] ?? r.reason}</span> · {formatDateTime(r.createdAt)} · expérience{" "}
                    {r.experience.slug ? (
                      <a href={`${SITE}/g/${r.experience.slug}`} target="_blank" rel="noreferrer" className="underline">
                        {r.experience.slug}
                      </a>
                    ) : (
                      "—"
                    )}{" "}
                    ({r.experience.status})
                  </p>
                </div>
                {r.details && <p className="rounded-lg bg-raised px-3 py-2 whitespace-pre-line">{r.details}</p>}
                {r.resolution && <p className="text-muted">Décision : {r.resolution}</p>}
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const why = window.prompt("Motif du retrait (journalisé) :", REASON[r.reason] ?? "");
                        if (why?.trim()) void run(() => api.resolveReport(r.id, "suspend", why.trim()), "Expérience retirée.");
                      }}
                      className="h-8 rounded-lg border border-danger/40 px-3 text-[0.8rem] text-danger hover:bg-danger/10"
                    >
                      Retirer l&apos;expérience
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const why = window.prompt("Pourquoi classer sans suite ? (journalisé)", "Pas de problème constaté");
                        if (why !== null) void run(() => api.resolveReport(r.id, "dismiss", why.trim()), "Signalement classé.");
                      }}
                      className="h-8 rounded-lg border border-line px-3 text-[0.8rem] hover:bg-raised"
                    >
                      Classer sans suite
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Expériences retirées" subtitle="Le destinataire voit « Cette expérience n'est plus disponible ». Rétablir la remet en ligne.">
          {suspended.error && <ErrorState message={suspended.error} onRetry={suspended.reload} />}
          {suspended.data?.length === 0 && <p className="py-4 text-[0.85rem] text-muted">Aucune expérience retirée.</p>}
          <ul className="divide-y divide-line">
            {suspended.data?.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[0.85rem]">
                <p className="min-w-0">
                  <span className="font-medium">{e.title ?? e.template}</span> · {e.slug ?? "—"} · {e.ownerEmail ?? "—"}
                  <span className="block text-[0.78rem] text-muted">
                    Retirée le {formatDateTime(e.suspendedAt)}
                    {e.reason ? ` : ${e.reason}` : ""}
                  </span>
                </p>
                <button type="button" onClick={() => void run(() => api.unsuspendExperience(e.id), "Expérience rétablie.")} className="h-8 rounded-lg border border-line px-3 text-[0.8rem] hover:bg-raised">
                  Rétablir
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

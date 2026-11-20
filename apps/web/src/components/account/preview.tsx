"use client";

import type { PublicPayload } from "@zaweli/template-engine/schema";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { FullPageStatus, RequireSession, useAccount } from "@/account/session";
import { ExperienceView } from "@/experiences/registry";
import { Banner } from "./ui";

/** Contenus d'exemple des modèles (sous licence ZAWELI) : ils complètent ce qui n'est pas encore rempli. */
const DEMOS: Record<string, () => Promise<PublicPayload>> = {
  "coffret@1.0.0": () => import("@zaweli/template-coffret").then((m) => m.coffretDemoPayload()),
  "eclat@1.0.0": () => import("@zaweli/template-eclat").then((m) => m.eclatDemoPayload()),
};

const isEmpty = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.length === 0);

/**
 * Brouillon + exemple : chaque champ vide prend la valeur de l'exemple. Le sel
 * des énigmes suit celles qui sont affichées (les réponses restent vérifiables).
 */
function merge(draft: PublicPayload, demo: PublicPayload | null): { payload: PublicPayload; filled: number } {
  if (!demo) return { payload: draft, filled: 0 };
  const fields = { ...draft.fields } as Record<string, unknown>;
  let filled = 0;
  let riddlesFromDemo = false;
  for (const [key, value] of Object.entries(demo.fields)) {
    if (!isEmpty(fields[key])) continue;
    fields[key] = value;
    filled++;
    if (Array.isArray(value) && value.some((x) => x && typeof x === "object" && "answerHash" in x)) riddlesFromDemo = true;
  }
  return { payload: { ...draft, fields: fields as PublicPayload["fields"], salt: riddlesFromDemo ? demo.salt : draft.salt }, filled };
}

function usePreview(id: string) {
  const { api, t } = useAccount();
  const [state, setState] = useState<{ payload: PublicPayload; rendererKey: string; filled: number } | { error: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const draft = await api.preview(id);
        const demo = await (DEMOS[draft.rendererKey]?.() ?? Promise.resolve(null)).catch(() => null);
        const { payload, filled } = merge(draft.payload, demo);
        if (alive) setState({ payload, rendererKey: draft.rendererKey, filled });
      } catch (err) {
        if (alive) setState({ error: err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable });
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, id, t.common.unavailable]);
  return state;
}

/** Aperçu réel du brouillon (§7.5) : lecture seule, rien n'est publié ni consommé. */
export function PreviewView() {
  return (
    <RequireSession>
      <Preview />
    </RequireSession>
  );
}

function Preview() {
  const { id } = useParams<{ id: string }>();
  const framed = useSearchParams().get("cadre") === "1";
  const state = usePreview(id);
  const { t, path } = useAccount();
  const [device, setDevice] = useState<"phone" | "full">("phone");

  if (!state) return <FullPageStatus text={t.common.loading} />;
  if ("error" in state) {
    return (
      <div className="mx-auto max-w-md px-5 py-24">
        <Banner tone="danger">{state.error}</Banner>
      </div>
    );
  }
  // Dans le cadre « téléphone » : l'expérience seule, à la taille d'un écran mobile.
  if (framed) return <ExperienceView rendererKey={state.rendererKey} payload={state.payload} mode="preview" />;

  const p = t.preview;
  return (
    <div className="min-h-svh bg-ink">
      <div className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-between gap-2 bg-ink/90 px-4 py-2 text-[0.85rem] text-paper backdrop-blur-sm">
        <p>
          <strong className="font-medium">{p.badge}</strong> · {p.note}
          {state.filled > 0 && <span className="text-paper/70"> · {p.filled(state.filled)}</span>}
        </p>
        <div className="flex items-center gap-2">
          <div role="group" aria-label={p.device} className="flex rounded-full border border-paper/30 p-0.5">
            {(["phone", "full"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={`min-h-9 rounded-full px-3 ${device === d ? "bg-paper text-ink" : "text-paper"}`}
              >
                {p[d]}
              </button>
            ))}
          </div>
          <Link href={path(`/espace/brouillon/${id}`)} className="min-h-9 rounded-full border border-paper/30 px-3 leading-9">
            {p.back}
          </Link>
        </div>
      </div>
      {device === "phone" ? (
        <div className="flex min-h-svh items-center justify-center px-4 pt-16 pb-6">
          <iframe
            title={p.frameTitle}
            src={`${path(`/espace/apercu/${id}`)}?cadre=1`}
            className="h-[min(844px,calc(100svh-6rem))] w-[min(390px,100%)] rounded-[2rem] border-[10px] border-black bg-black shadow-2xl"
          />
        </div>
      ) : (
        <ExperienceView rendererKey={state.rendererKey} payload={state.payload} mode="preview" />
      )}
    </div>
  );
}

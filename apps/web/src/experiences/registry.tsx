"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ExperienceMode } from "@zaweli/template-engine/react";
import type { PublicPayload } from "@zaweli/template-engine/schema";

type RendererProps = { payload: PublicPayload; mode: ExperienceMode; storageKey?: string };

function Loading() {
  return <div className="min-h-svh bg-[#2a0509]" aria-busy="true" aria-label="Chargement de l'expérience" />;
}

/**
 * Registre des renderers (architecture §5.1) : clé stockée en base → code.
 * Chaque version est chargée à la demande (un template n'alourdit pas les autres).
 * Une version publiée garde son renderer pour toujours.
 */
const RENDERERS: Record<string, ComponentType<RendererProps>> = {
  "coffret@1.0.0": dynamic(() => import("./coffret-v1"), { loading: Loading }),
  "eclat@1.0.0": dynamic(() => import("./eclat-v1"), { loading: Loading }),
};

export function ExperienceView({ rendererKey, ...props }: RendererProps & { rendererKey: string }) {
  const Renderer = RENDERERS[rendererKey];
  if (!Renderer) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl">Expérience indisponible</h1>
        <p className="mt-3 text-muted">Ce modèle n&apos;est pas pris en charge par cette version du site.</p>
      </main>
    );
  }
  return <Renderer {...props} />;
}

import { healthResponseSchema, type HealthResponse } from "@zaweli/shared-types";

/**
 * URL de l'API côté serveur Next. API_URL_INTERNAL permet, en production,
 * de passer par un réseau privé ; sinon on utilise l'URL publique.
 */
function apiBaseUrl(): string {
  const url = process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL manquante (lance `pnpm env:local`).");
  return url.replace(/\/+$/, "");
}

export type HealthResult = { reachable: true; health: HealthResponse } | { reachable: false; reason: string };

/** Santé de l'API, validée par le contrat partagé (aucune donnée non vérifiée affichée). */
export async function fetchHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/health`, { signal: AbortSignal.timeout(3000) });
    const parsed = healthResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { reachable: false, reason: "réponse inattendue" };
    return { reachable: true, health: parsed.data };
  } catch (error) {
    return { reachable: false, reason: error instanceof Error ? error.message : "inconnue" };
  }
}

import {
  experienceSlugSchema,
  healthResponseSchema,
  publicExperienceResponseSchema,
  type HealthResponse,
  type PublicExperienceResponse,
} from "@zaweli/shared-types";

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

export type PublicExperienceState =
  | { kind: "ok"; experience: PublicExperienceResponse }
  /** Protégée par un code : la page le demande au destinataire. */
  | { kind: "locked" }
  /** Pas encore ouverte : date choisie par l'expéditeur. */
  | { kind: "later"; availableFrom: string };

/**
 * Expérience publiée, pour le destinataire. `null` si elle n'est pas
 * disponible (inexistante, désactivée, suspendue…) : l'API ne distingue pas.
 */
export async function fetchPublicExperience(slug: string): Promise<PublicExperienceState | null> {
  if (!experienceSlugSchema.safeParse(slug).success) return null;
  const res = await fetch(`${apiBaseUrl()}/v1/public/experiences/${slug}`, { signal: AbortSignal.timeout(5000) });
  if (res.status === 404) return null;
  if (res.status === 401) return { kind: "locked" };
  if (res.status === 423) {
    const body = (await res.json().catch(() => null)) as { error?: { details?: { availableFrom?: string } } } | null;
    return { kind: "later", availableFrom: body?.error?.details?.availableFrom ?? new Date().toISOString() };
  }
  if (!res.ok) throw new Error(`API : ${res.status}`);
  return { kind: "ok", experience: publicExperienceResponseSchema.parse(await res.json()) };
}

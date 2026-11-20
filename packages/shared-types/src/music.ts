import { z } from "zod";

/**
 * Musique choisie par l'expéditeur (cahier des charges §11.1, docs/12 §6).
 *
 * Source préparée : Audius (catalogue ouvert, API publique). Le choix est
 * enregistré comme une référence (identifiant + crédits), jamais comme un
 * fichier copié : la lecture se fait depuis Audius, au premier geste du
 * destinataire.
 */
export const AUDIUS_API_URL = "https://api.audius.co/v1";

export const audiusTrackIdSchema = z.string().regex(/^[A-Za-z0-9]{1,20}$/);

export const musicChoiceSchema = z.strictObject({
  source: z.literal("audius"),
  trackId: audiusTrackIdSchema,
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(120),
  /** Page du titre sur audius.co : crédit et lien vers l'artiste. */
  permalink: z.string().regex(/^\/[A-Za-z0-9._~%/-]{1,300}$/),
  durationSeconds: z.number().int().positive().max(24 * 3600),
  artworkUrl: z.url({ protocol: /^https$/ }).nullable(),
});
export type MusicChoice = z.infer<typeof musicChoiceSchema>;

export const musicSearchSchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export type MusicSearchQuery = z.infer<typeof musicSearchSchema>;

export type MusicSearchResponse = { tracks: MusicChoice[] };

/** Adresse de lecture MP3 d'un titre Audius (redirection vers un nœud de contenu, accepte Range). */
export function audiusStreamUrl(trackId: string, apiKey?: string | null): string {
  // Paquet sans types DOM ni Node : encodage manuel plutôt qu'URLSearchParams.
  const query = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : "";
  return `${AUDIUS_API_URL}/tracks/${encodeURIComponent(trackId)}/stream${query}`;
}

export const audiusPageUrl = (permalink: string) => `https://audius.co${permalink}`;

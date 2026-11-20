import { Inject, Injectable, Logger } from "@nestjs/common";
import { type MusicChoice, musicChoiceSchema } from "@zaweli/shared-types";
import { ApiException } from "../common/api-exception.js";
import { ENV, type Env } from "../config/env.js";

/** Champs utiles d'un titre renvoyé par GET /v1/tracks/search (vérifiés sur une réponse réelle, 20/11/2026). */
type AudiusTrack = {
  id?: string;
  title?: string;
  duration?: number;
  permalink?: string;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_unlisted?: boolean;
  is_delete?: boolean;
  stream_conditions?: unknown;
  access?: { stream?: boolean };
  artwork?: Record<string, string | string[] | undefined> | null;
  user?: { name?: string; handle?: string };
};

/**
 * Recherche de musique dans le catalogue ouvert d'Audius (préparation,
 * docs/12 §6). Seuls les titres lisibles librement sont proposés : pas de
 * titre payant, réservé ou masqué.
 */
@Injectable()
export class AudiusService {
  private readonly logger = new Logger("Audius");

  constructor(@Inject(ENV) private readonly env: Env) {}

  async search(query: string, limit: number): Promise<MusicChoice[]> {
    const url = new URL(`${this.env.AUDIUS_API_URL.replace(/\/+$/, "")}/tracks/search`);
    url.searchParams.set("query", query);
    // On demande plus large : une partie des résultats est écartée (titres réservés).
    url.searchParams.set("limit", String(Math.min(limit * 2, 40)));
    url.searchParams.set("sort_method", "relevant");
    if (this.env.AUDIUS_API_KEY) url.searchParams.set("api_key", this.env.AUDIUS_API_KEY);

    let body: { data?: AudiusTrack[] };
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = (await res.json()) as { data?: AudiusTrack[] };
    } catch (e) {
      this.logger.warn(`recherche indisponible : ${(e as Error).message}`);
      throw new ApiException("SERVICE_UNAVAILABLE");
    }
    return (body.data ?? []).flatMap((t) => this.toChoice(t)).slice(0, limit);
  }

  private toChoice(t: AudiusTrack): MusicChoice[] {
    const playable = t.is_streamable === true && t.access?.stream !== false && !t.is_stream_gated && !t.stream_conditions && !t.is_unlisted && !t.is_delete;
    if (!playable) return [];
    const artwork = t.artwork?.["480x480"] ?? t.artwork?.["150x150"];
    const parsed = musicChoiceSchema.safeParse({
      source: "audius",
      trackId: t.id,
      title: t.title,
      artist: t.user?.name || t.user?.handle,
      permalink: t.permalink,
      durationSeconds: Math.round(t.duration ?? 0),
      artworkUrl: typeof artwork === "string" && artwork.startsWith("https://") ? artwork : null,
    });
    return parsed.success ? [parsed.data] : [];
  }
}

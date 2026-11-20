import { Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type MusicSearchQuery, type MusicSearchResponse, musicSearchSchema } from "@zaweli/shared-types";
import { AudiusService } from "./audius.service.js";

/**
 * Recherche de musique pour l'expéditeur (session obligatoire). Préparée,
 * pas encore proposée dans l'assistant (docs/12 §6).
 */
@Controller("music")
export class MusicController {
  constructor(private readonly audius: AudiusService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("audius/search")
  async search(@Query({ schema: musicSearchSchema }) query: MusicSearchQuery): Promise<MusicSearchResponse> {
    return { tracks: await this.audius.search(query.q, query.limit) };
  }
}

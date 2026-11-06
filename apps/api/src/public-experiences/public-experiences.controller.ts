import { Controller, Get, Inject, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { experienceSlugSchema, type PublicExperienceResponse } from "@zaweli/shared-types";
import { type Kysely, sql } from "kysely";
import { Public } from "../auth/auth.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";

/**
 * Expériences publiées, côté DESTINATAIRE (sans compte).
 *
 * - Ne livre que l'instantané courant (public_payload) : jamais le brouillon,
 *   jamais la partie protégée.
 * - Une expérience désactivée, suspendue, supprimée, pas encore disponible
 *   ou inexistante renvoie la même 404 : on ne révèle pas son existence.
 * - Limitation de débit dédiée contre l'énumération des liens.
 */
@Controller("public/experiences")
export class PublicExperiencesController {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(":slug")
  async bySlug(@Param("slug") slug: string): Promise<PublicExperienceResponse> {
    if (!experienceSlugSchema.safeParse(slug).success) throw this.unavailable();

    const row = await this.db
      .selectFrom("app.experiences as e")
      .innerJoin("app.experience_snapshots as s", "s.id", "e.current_snapshot_id")
      .innerJoin("app.template_versions as tv", "tv.id", "s.template_version_id")
      .select(["tv.renderer_key as rendererKey", "s.public_payload as payload", "e.access_code_hash as accessCodeHash"])
      .where("e.slug", "=", slug)
      .where("e.status", "=", "published")
      .where((eb) => eb.or([eb("e.available_from", "is", null), eb("e.available_from", "<=", sql<Date>`now()`)]))
      .executeTakeFirst();

    // Le code d'accès (fonction S du cahier des charges) n'est pas encore géré :
    // une expérience protégée par code n'est pas servie plutôt que servie sans contrôle.
    if (!row || row.accessCodeHash) throw this.unavailable();

    return { rendererKey: row.rendererKey, payload: row.payload as PublicExperienceResponse["payload"] };
  }

  private unavailable() {
    return new ApiException("NOT_FOUND", "Cette expérience n'est pas disponible.");
  }
}

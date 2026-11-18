import { createHash } from "node:crypto";
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type CreateReportRequest,
  createReportSchema,
  experienceSlugSchema,
  type PublicExperienceResponse,
} from "@zaweli/shared-types";
import type { Request } from "express";
import { type Kysely, sql } from "kysely";
import { z } from "zod";
import { Public } from "../auth/auth.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";
import { audit } from "../database/transaction.js";
import { RequestId } from "../i18n/locale.js";

type PublicGiftLike = { id: string; type: string; status: string };

/**
 * Expériences publiées, côté DESTINATAIRE (sans compte, principe P7).
 *
 * - Ne livre que l'instantané courant (public_payload) : jamais le brouillon,
 *   jamais la partie protégée, sauf cadeau par cadeau au déballage (§9.4).
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
    const row = await this.live(slug);
    const payload = row.payload as PublicExperienceResponse["payload"];

    // Les statuts de cadeaux sont décidés côté serveur et peuvent évoluer après
    // la publication (« remis », « annulé ») : on livre toujours le statut courant.
    const gifts = await this.db.selectFrom("app.gifts").select(["id", "status"]).where("experience_id", "=", row.id).execute();
    if (gifts.length) {
      const status = new Map(gifts.map((g) => [g.id, g.status]));
      for (const value of Object.values(payload.fields)) {
        if (!Array.isArray(value)) continue;
        for (const item of value as PublicGiftLike[]) {
          if (item && typeof item === "object" && "type" in item && status.has(item.id)) item.status = status.get(item.id)!;
        }
      }
    }
    return { rendererKey: row.rendererKey, payload };
  }

  /** Données protégées d'un cadeau (ex. code d'un bon), livrées seulement au déballage. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":slug/gifts/:giftId/reveal")
  @HttpCode(200)
  async reveal(@Param("slug") slug: string, @Param("giftId", { schema: z.uuid() }) giftId: string): Promise<{ data: Record<string, unknown> }> {
    const row = await this.live(slug);
    const data = (row.protectedPayload as { gifts?: Record<string, Record<string, unknown>> }).gifts?.[giftId];
    if (!data) throw new ApiException("GIFT_NOT_PROTECTED");
    return { data };
  }

  /** Signalement d'un contenu abusif (§7.6, §11.5). Aucune donnée personnelle conservée en clair. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":slug/reports")
  @HttpCode(202)
  async report(
    @Req() req: Request,
    @RequestId() requestId: string | null,
    @Param("slug") slug: string,
    @Body({ schema: createReportSchema }) body: CreateReportRequest,
  ): Promise<{ received: true }> {
    if (!experienceSlugSchema.safeParse(slug).success) throw this.unavailable();
    // On accepte aussi le signalement d'une expérience déjà retirée (même réponse : rien n'est révélé).
    const experience = await this.db.selectFrom("app.experiences").select("id").where("slug", "=", slug).executeTakeFirst();
    if (!experience) throw this.unavailable();
    const day = new Date().toISOString().slice(0, 10);
    const reporterHash = createHash("sha256").update(`${req.ip ?? ""}|${day}`).digest("hex");
    const report = await this.db
      .insertInto("app.reports")
      .values({ experience_id: experience.id, reason: body.reason, details: body.details ?? null, reporter_hash: reporterHash })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(this.db, {
      actorType: "anonymous",
      action: "report.created",
      entityType: "report",
      entityId: report.id,
      data: { experienceId: experience.id, reason: body.reason },
      requestId,
    });
    return { received: true };
  }

  private async live(slug: string) {
    if (!experienceSlugSchema.safeParse(slug).success) throw this.unavailable();
    const row = await this.db
      .selectFrom("app.experiences as e")
      .innerJoin("app.experience_snapshots as s", "s.id", "e.current_snapshot_id")
      .innerJoin("app.template_versions as tv", "tv.id", "s.template_version_id")
      .select([
        "e.id",
        "tv.renderer_key as rendererKey",
        "s.public_payload as payload",
        "s.protected_payload as protectedPayload",
        "e.access_code_hash as accessCodeHash",
      ])
      .where("e.slug", "=", slug)
      .where("e.status", "=", "published")
      .where((eb) => eb.or([eb("e.available_from", "is", null), eb("e.available_from", "<=", sql<Date>`now()`)]))
      .executeTakeFirst();

    // Le code d'accès (fonction S du cahier des charges) n'est pas encore géré :
    // une expérience protégée par code n'est pas servie plutôt que servie sans contrôle.
    if (!row || row.accessCodeHash) throw this.unavailable();
    return row;
  }

  private unavailable() {
    return new ApiException("NOT_FOUND");
  }
}

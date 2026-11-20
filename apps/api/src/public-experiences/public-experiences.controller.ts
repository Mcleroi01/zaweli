import { createHash } from "node:crypto";
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type CreateReportRequest,
  createReportSchema,
  experienceSlugSchema,
  type PublicExperienceResponse,
  type UnlockExperienceRequest,
  unlockExperienceSchema,
} from "@zaweli/shared-types";
import type { Request } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import { Public } from "../auth/auth.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";
import { audit } from "../database/transaction.js";
import { verifyAccessCode } from "../experiences/experiences.service.js";
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
  async bySlug(@Param("slug") slug: string, @Headers("x-access-code") code: string | undefined): Promise<PublicExperienceResponse> {
    return this.render(await this.live(slug, code));
  }

  /** Code saisi par le destinataire : renvoie l'expérience si c'est le bon (débit limité contre les essais en série). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":slug/unlock")
  @HttpCode(200)
  async unlock(@Param("slug") slug: string, @Body({ schema: unlockExperienceSchema }) body: UnlockExperienceRequest): Promise<PublicExperienceResponse> {
    return this.render(await this.live(slug, body.code));
  }

  private async render(row: Awaited<ReturnType<PublicExperiencesController["live"]>>): Promise<PublicExperienceResponse> {
    const payload = row.payload as PublicExperienceResponse["payload"];
    // La musique se règle sans republier : on livre toujours le choix courant.
    if (row.music) payload.music = row.music;
    else delete payload.music;

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
  async reveal(
    @Param("slug") slug: string,
    @Param("giftId", { schema: z.uuid() }) giftId: string,
    @Headers("x-access-code") code: string | undefined,
  ): Promise<{ data: Record<string, unknown> }> {
    const row = await this.live(slug, code);
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

  /**
   * Expérience servie au destinataire. Inexistante, désactivée ou suspendue :
   * la même 404. Pas encore ouverte : 423 avec la date (choix de l'expéditeur).
   * Protégée : 401 sans code, 403 avec un mauvais code.
   */
  async live(slug: string, code?: string) {
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
        "e.available_from as availableFrom",
        "e.music",
      ])
      .where("e.slug", "=", slug)
      .where("e.status", "=", "published")
      .executeTakeFirst();

    if (!row) throw this.unavailable();
    if (row.availableFrom && new Date(row.availableFrom).getTime() > Date.now()) {
      throw new ApiException("NOT_YET_AVAILABLE", { availableFrom: new Date(row.availableFrom).toISOString() });
    }
    if (row.accessCodeHash) {
      if (!code) throw new ApiException("ACCESS_CODE_REQUIRED");
      if (!verifyAccessCode(code, row.accessCodeHash)) throw new ApiException("ACCESS_CODE_INVALID");
    }
    return row;
  }

  private unavailable() {
    return new ApiException("NOT_FOUND");
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type CreateExperienceRequest,
  createExperienceSchema,
  type CreateGiftRequest,
  createGiftSchema,
  type DuplicateExperienceRequest,
  duplicateExperienceSchema,
  type ExperienceSettingsRequest,
  experienceSettingsSchema,
  EXPERIENCE_STATUSES,
  type ExperienceStatus,
  giftStatusChangeSchema,
  type Locale,
  type PublishExperienceRequest,
  publishExperienceSchema,
  type UpdateExperienceRequest,
  updateExperienceSchema,
  type UpdateGiftRequest,
  updateGiftSchema,
} from "@zaweli/shared-types";
import { z } from "zod";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { RequestId, RequestLocale } from "../i18n/locale.js";
import { LicensingService } from "../licensing/licensing.service.js";
import { ExperiencesService } from "./experiences.service.js";

const id = z.uuid();

/** Expériences de l'expéditeur : toutes les routes exigent une session et vérifient la propriété. */
@Controller()
export class ExperiencesController {
  constructor(
    private readonly experiences: ExperiencesService,
    private readonly licensing: LicensingService,
  ) {}

  @Get("experiences")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status", { schema: z.enum(EXPERIENCE_STATUSES).optional() }) status?: ExperienceStatus,
  ) {
    return this.experiences.list(user.id, status);
  }

  @Post("experiences")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @RequestLocale() locale: Locale,
    @Body({ schema: createExperienceSchema }) body: CreateExperienceRequest,
  ) {
    return this.experiences.create({ userId: user.id, requestId }, body, locale);
  }

  @Get("experiences/:id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id", { schema: id }) experienceId: string) {
    return this.experiences.detail(user.id, experienceId);
  }

  @Patch("experiences/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Body({ schema: updateExperienceSchema }) body: UpdateExperienceRequest,
  ) {
    return this.experiences.update({ userId: user.id, requestId }, experienceId, body);
  }

  @Delete("experiences/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) experienceId: string) {
    return this.experiences.remove({ userId: user.id, requestId }, experienceId);
  }

  /** Code d'accès, date d'ouverture, musique : appliqués tout de suite, sans republier. */
  @Put("experiences/:id/settings")
  settings(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Body({ schema: experienceSettingsSchema }) body: ExperienceSettingsRequest,
  ) {
    return this.experiences.settings({ userId: user.id, requestId }, experienceId, body);
  }

  /** Nouveau brouillon pour une autre personne, à partir de celle-ci. */
  @Post("experiences/:id/duplicate")
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Body({ schema: duplicateExperienceSchema }) body: DuplicateExperienceRequest,
  ) {
    return this.experiences.duplicate({ userId: user.id, requestId }, experienceId, body.recipientId);
  }

  /** Aperçu réel du brouillon, réservé à son auteur (rien n'est publié ni consommé). */
  @Get("experiences/:id/preview")
  preview(@CurrentUser() user: AuthenticatedUser, @Param("id", { schema: id }) experienceId: string) {
    return this.experiences.preview(user.id, experienceId);
  }

  /** Licences capables de couvrir la publication (indicatif : la publication revérifie tout). */
  @Get("experiences/:id/eligibility")
  eligibility(@CurrentUser() user: AuthenticatedUser, @RequestLocale() locale: Locale, @Param("id", { schema: id }) experienceId: string) {
    return this.experiences.eligibility(user.id, experienceId, locale);
  }

  @Post("experiences/:id/publish")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Body({ schema: publishExperienceSchema.optional() }) body: PublishExperienceRequest | undefined,
  ) {
    return this.experiences.publish({ userId: user.id, requestId }, experienceId, body ?? {});
  }

  @Post("experiences/:id/disable")
  @HttpCode(200)
  disable(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) experienceId: string) {
    return this.experiences.setEnabled({ userId: user.id, requestId }, experienceId, false);
  }

  @Post("experiences/:id/enable")
  @HttpCode(200)
  enable(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) experienceId: string) {
    return this.experiences.setEnabled({ userId: user.id, requestId }, experienceId, true);
  }

  @Post("experiences/:id/gifts")
  addGift(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Body({ schema: createGiftSchema }) body: CreateGiftRequest,
  ) {
    return this.experiences.addGift({ userId: user.id, requestId }, experienceId, body);
  }

  @Patch("experiences/:id/gifts/:giftId")
  updateGift(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Param("giftId", { schema: id }) giftId: string,
    @Body({ schema: updateGiftSchema }) body: UpdateGiftRequest,
  ) {
    return this.experiences.updateGift({ userId: user.id, requestId }, experienceId, giftId, body);
  }

  @Delete("experiences/:id/gifts/:giftId")
  @HttpCode(204)
  removeGift(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Param("giftId", { schema: id }) giftId: string,
  ) {
    return this.experiences.removeGift({ userId: user.id, requestId }, experienceId, giftId);
  }

  @Post("experiences/:id/gifts/:giftId/status")
  @HttpCode(200)
  giftStatus(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Param("giftId", { schema: id }) giftId: string,
    @Body({ schema: giftStatusChangeSchema }) body: { status: string },
  ) {
    return this.experiences.setGiftStatus({ userId: user.id, requestId }, experienceId, giftId, body.status);
  }

  /** Mes licences : validité, quotas, destinataires liés, quota IA. */
  @Get("licenses")
  licenses(@CurrentUser() user: AuthenticatedUser, @RequestLocale() locale: Locale) {
    return this.licensing.listForUser(user.id, locale);
  }
}

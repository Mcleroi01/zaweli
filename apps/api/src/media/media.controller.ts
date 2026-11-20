import { Body, Controller, Delete, HttpCode, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type CreateMediaUploadRequest, createMediaUploadSchema, type MediaUrlsRequest, mediaUrlsSchema } from "@zaweli/shared-types";
import { z } from "zod";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { RequestId } from "../i18n/locale.js";
import { MediaService } from "./media.service.js";

const id = z.uuid();

/** Photos de l'expéditeur (session obligatoire, propriété vérifiée à chaque appel). */
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("uploads")
  createUpload(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Body({ schema: createMediaUploadSchema }) body: CreateMediaUploadRequest) {
    return this.media.createUpload({ userId: user.id, requestId }, body);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(":id/complete")
  @HttpCode(200)
  complete(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) mediaId: string) {
    return this.media.complete({ userId: user.id, requestId }, mediaId);
  }

  /** Adresses temporaires des vignettes (une requête pour toutes les photos d'un brouillon). */
  @Post("urls")
  @HttpCode(200)
  urls(@CurrentUser() user: AuthenticatedUser, @Body({ schema: mediaUrlsSchema }) body: MediaUrlsRequest) {
    return this.media.urls(user.id, body.ids);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) mediaId: string): Promise<void> {
    await this.media.remove({ userId: user.id, requestId }, mediaId);
  }
}

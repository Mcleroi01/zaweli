import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type AttachReferralRequest, attachReferralSchema, type ReferralSummaryResponse } from "@zaweli/shared-types";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { RequestId } from "../i18n/locale.js";
import { ReferralsService } from "./referrals.service.js";

/** Parrainage du compte connecté : son lien, ses filleuls, ses cartes cadeaux. */
@Controller()
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get("referrals/me")
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ReferralSummaryResponse> {
    return this.referrals.summary(user.id);
  }

  /** Un nouveau compte déclare le code reçu par le lien (une seule fois). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("me/referral")
  @HttpCode(204)
  async attach(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Body({ schema: attachReferralSchema }) body: AttachReferralRequest): Promise<void> {
    await this.referrals.attach(user.id, body.code, requestId);
  }
}

import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type ClaimGiftRequest,
  claimGiftSchema,
  type CreateOrderRequest,
  createOrderSchema,
  type FinalizePaymentRequest,
  finalizePaymentSchema,
  type FundGiftRequest,
  fundGiftSchema,
  type OrderQuoteQuery,
  orderQuoteSchema,
} from "@zaweli/shared-types";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser, Public } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { RequestId } from "../i18n/locale.js";
import { PaymentsService } from "./payments.service.js";

const id = z.uuid();

/** Achats de formules et cadeaux d'argent de l'expéditeur (session obligatoire). */
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("payments/options")
  options() {
    return this.payments.options();
  }

  @Get("orders")
  orders(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null) {
    return this.payments.orders({ userId: user.id, requestId });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("orders")
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body({ schema: createOrderSchema }) body: CreateOrderRequest,
  ) {
    return this.payments.createOrder({ userId: user.id, requestId }, body, idempotencyKey);
  }

  @Get("orders/quote")
  quote(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Query({ schema: orderQuoteSchema }) query: OrderQuoteQuery) {
    return this.payments.quote({ userId: user.id, requestId }, query.planCode, query.currency);
  }

  @Get("orders/:id")
  order(@CurrentUser() user: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) orderId: string) {
    return this.payments.order({ userId: user.id, requestId }, orderId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("orders/:id/finalize")
  @HttpCode(200)
  finalizeOrder(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) orderId: string,
    @Body({ schema: finalizePaymentSchema }) body: FinalizePaymentRequest,
  ) {
    return this.payments.finalizeOrder({ userId: user.id, requestId }, orderId, body.otp);
  }

  @Get("experiences/:id/gifts/:giftId/funding")
  funding(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Param("giftId", { schema: id }) giftId: string,
  ) {
    return this.payments.giftFunding({ userId: user.id, requestId }, experienceId, giftId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("experiences/:id/gifts/:giftId/funding")
  @HttpCode(200)
  fund(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Param("giftId", { schema: id }) giftId: string,
    @Body({ schema: fundGiftSchema }) body: FundGiftRequest,
  ) {
    return this.payments.fundGift({ userId: user.id, requestId }, experienceId, giftId, body.payer);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("experiences/:id/gifts/:giftId/funding/finalize")
  @HttpCode(200)
  finalizeFunding(
    @CurrentUser() user: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Param("giftId", { schema: id }) giftId: string,
    @Body({ schema: finalizePaymentSchema }) body: FinalizePaymentRequest,
  ) {
    return this.payments.finalizeGiftFunding({ userId: user.id, requestId }, experienceId, giftId, body.otp);
  }
}

/**
 * Réception d'un cadeau d'argent par le DESTINATAIRE, sans compte.
 * Le lien de l'expérience fait office de clé : il ne doit être partagé
 * qu'avec la personne. Un seul envoi à la fois, débit limité.
 */
@Controller("public/experiences")
export class GiftClaimController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(":slug/gifts/:giftId/claim")
  info(@Param("slug") slug: string, @Param("giftId", { schema: id }) giftId: string, @Headers("x-access-code") code: string | undefined) {
    return this.payments.claimInfo(slug, giftId, code);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":slug/gifts/:giftId/claim")
  @HttpCode(200)
  claim(
    @RequestId() requestId: string | null,
    @Param("slug") slug: string,
    @Param("giftId", { schema: id }) giftId: string,
    @Body({ schema: claimGiftSchema }) body: ClaimGiftRequest,
    @Headers("x-access-code") code: string | undefined,
  ) {
    return this.payments.claim(slug, giftId, body, requestId, code);
  }
}

/** Webhooks MbiyoPay : répondre 200 vite ; une erreur 500 provoque un nouvel envoi. */
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post("mbiyopay")
  @HttpCode(200)
  mbiyopay(@Req() req: Request & { rawBody?: Buffer }, @Headers("signature") signature: string | undefined) {
    return this.payments.handleWebhook(req.rawBody, req.body as unknown, signature);
  }
}

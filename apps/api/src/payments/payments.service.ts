import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type ClaimGiftRequest,
  countriesForCurrency,
  type CreateOrderRequest,
  type GiftClaimResponse,
  type GiftFundingResponse,
  MOBILE_MONEY_COUNTRIES,
  type MobileMoneyAccount,
  mobileMoneyCountry,
  normalizePhone,
  type OrderQuoteResponse,
  type OrderResponse,
  type OrderStatus,
  type PaymentNext,
  type PaymentOptionsResponse,
} from "@zaweli/shared-types";
import { sql } from "kysely";
import { ApiException } from "../common/api-exception.js";
import { ENV, type Env } from "../config/env.js";
import { DB } from "../database/database.module.js";
import type { PaymentStatus } from "../database/database.types.js";
import { audit, type Db, inTransaction, readSetting, type Tx, toIso } from "../database/transaction.js";
import { verifyAccessCode } from "../experiences/experiences.service.js";
import { MailService } from "../notifications/mail.service.js";
import { ReferralsService } from "../referrals/referrals.service.js";
import { type GatewayStatus, type GatewayTransaction, GatewayRejected, MobileMoneyGateway } from "./mobile-money.gateway.js";

type Ctx = { userId: string; requestId: string | null };

// ---------------------------------------------------------------------
// Montants : en centimes (BigInt), jamais en flottants.
// ---------------------------------------------------------------------

/** Devises sans subdivision en pratique pour le mobile money : montants entiers. */
const WHOLE_UNITS = new Set(["XOF", "XAF", "CDF", "GNF", "UGX", "RWF", "TZS"]);

const toCents = (value: string): bigint => {
  const [int, frac = ""] = value.trim().split(".");
  return BigInt(int!) * 100n + BigInt((frac + "00").slice(0, 2));
};
const fromCents = (cents: bigint): string => `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** Taux « 0.035 » → fraction exacte ; null si absent ou invalide. */
export function parseRate(value: unknown): { num: bigint; den: bigint; text: string } | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^(0(\.\d{1,6})?|1(\.0{1,6})?)$/.test(text)) return null;
  const frac = text.split(".")[1] ?? "";
  return { num: BigInt(text.replace(".", "")), den: 10n ** BigInt(frac.length), text };
}

/** Frais facturés à l'expéditeur, arrondis au-dessus (à l'unité pour les devises sans centimes). */
export function feeFor(amount: string, currency: string, rate: { num: bigint; den: bigint }): string {
  let fee = ceilDiv(toCents(amount) * rate.num, rate.den);
  if (WHOLE_UNITS.has(currency)) fee = ceilDiv(fee, 100n) * 100n;
  return fromCents(fee);
}

/** Réduction de filleul, arrondie en dessous (au centime, à l'unité pour les devises sans centimes). */
function discountFor(amount: string, currency: string, rate: string | null): string {
  const parsed = parseRate(rate);
  if (!parsed) return "0.00";
  let cents = (toCents(amount) * parsed.num) / parsed.den;
  if (WHOLE_UNITS.has(currency)) cents = (cents / 100n) * 100n;
  return fromCents(cents);
}

const STATUS_OF: Record<GatewayStatus, PaymentStatus> = { pending: "pending", successful: "succeeded", failed: "failed", cancelled: "cancelled" };
const isOpen = (s: PaymentStatus) => s === "initiated" || s === "pending";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un réseau ne revérifie pas plus souvent que ça (les pages de suivi interrogent toutes les 3 s). */
const RECHECK_MS = 4_000;
/** Sans trace chez le prestataire passé ce délai, la demande n'est jamais partie. */
const LOST_AFTER_MS = 15 * 60_000;

/**
 * Paiements mobile money (docs/12).
 *
 * Règle d'or (cahier des charges §8.6, P6) : rien n'est « payé » sur la foi
 * du navigateur ni d'un webhook seul. Chaque confirmation relit la
 * transaction chez MbiyoPay avec notre clé, puis est appliquée dans une
 * transaction SQL où l'acteur est « provider » — les déclencheurs refusent
 * tout autre acteur.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger("Payments");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly gateway: MobileMoneyGateway,
    private readonly referrals: ReferralsService,
    private readonly mail: MailService,
  ) {}

  async options(): Promise<PaymentOptionsResponse> {
    const [enabled, rate] = await Promise.all([
      readSetting<boolean>(this.db, "gifts.money_transfers_enabled", false),
      readSetting<unknown>(this.db, "payments.money_fee_rate", null),
    ]);
    const parsed = parseRate(rate);
    return {
      mode: this.gateway.mode,
      countries: [...MOBILE_MONEY_COUNTRIES],
      moneyTransfers: { enabled: enabled === true && this.gateway.mode !== "disabled" && parsed !== null, feeRate: parsed?.text ?? null },
    };
  }

  // -------------------------------------------------------------------
  // Achat d'une formule
  // -------------------------------------------------------------------

  /** Prix d'une formule pour ce compte : réduction de filleul et carte cadeau disponibles. */
  async quote(ctx: Ctx, planCode: string, currency: string): Promise<OrderQuoteResponse> {
    const price = await this.price(planCode, currency);
    const q = await this.pricing(this.db, ctx.userId, price.amount, price.currency, true);
    return {
      planCode,
      currency: price.currency,
      listAmount: price.amount,
      discountAmount: q.discount,
      discountRate: q.discountRate,
      giftCardBalance: q.balance,
      creditAmount: q.credit,
      totalWithoutCredit: fromCents(toCents(price.amount) - toCents(q.discount)),
      totalWithCredit: q.amount,
    };
  }

  async createOrder(ctx: Ctx, body: CreateOrderRequest, idempotencyKey: string | undefined): Promise<OrderResponse> {
    const key = idempotencyKey && /^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey) ? idempotencyKey : `auto-${randomUUID()}`;
    const existing = await this.db.selectFrom("app.orders").select("id").where("user_id", "=", ctx.userId).where("idempotency_key", "=", key).executeTakeFirst();
    if (existing) return this.order(ctx, existing.id);
    const price = await this.price(body.planCode, body.currency);

    // Pays de la vente, figé à l'achat : celui du payeur, sinon celui du compte (déclaré ou détecté).
    const accountCountry = body.payer
      ? null
      : ((await this.db.selectFrom("app.profiles").select("country_code").where("id", "=", ctx.userId).executeTakeFirst())?.country_code ?? null);

    const order = await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const q = await this.pricing(trx, ctx.userId, price.amount, price.currency, body.useGiftCard);
      const toPay = toCents(q.amount) > 0n;
      if (toPay) this.requireGateway();
      if (toPay && !body.payer) throw new ApiException("PAYER_REQUIRED");
      const account = toPay ? this.account(body.payer!, price.currency, q.amount) : null;
      const row = await trx
        .insertInto("app.orders")
        .values({
          user_id: ctx.userId,
          plan_id: price.planId,
          plan_price_id: price.priceId,
          amount: q.amount,
          list_amount: price.amount,
          discount_amount: q.discount,
          credit_amount: q.credit,
          currency: price.currency,
          idempotency_key: key,
          provider: toPay ? "mbiyopay" : "gift_card",
          country_code: body.payer?.countryCode ?? accountCountry,
          expires_at: new Date(Date.now() + 60 * 60_000),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      // La carte cadeau est réservée tout de suite (rendue si le paiement échoue).
      if (toCents(q.credit) > 0n) await this.spendCredit(trx, ctx.userId, row.id, price.currency, q.credit);
      await audit(trx, {
        actorType: "user",
        actorId: ctx.userId,
        action: "order.created",
        entityType: "order",
        entityId: row.id,
        data: { planCode: body.planCode, listAmount: price.amount, discount: q.discount, credit: q.credit, amount: q.amount, currency: price.currency, network: body.payer?.network ?? null },
        requestId: ctx.requestId,
      });
      if (!toPay) {
        // Entièrement couverte par la carte : la base vérifie la couverture et active la licence.
        await sql`select app.settle_credit_order(${row.id}::uuid)`.execute(trx);
        const granted = await this.referrals.onOrderPaid(trx, ctx.userId, row.id);
        await audit(trx, { actorType: "system", action: "order.paid", entityType: "order", entityId: row.id, data: { by: "gift_card", credit: q.credit } });
        return { id: row.id, account: null, amount: q.amount, granted };
      }
      return { id: row.id, account, amount: q.amount, granted: [] as Array<{ id: string; threshold: number }> };
    });

    if (!order.account) {
      void this.afterPaid(order.id, order.granted);
      return this.order(ctx, order.id);
    }
    try {
      const started = await this.gateway.payin({ orderId: order.id, amount: Number(order.amount), currency: price.currency, ...order.account, callbackUrl: this.callbackUrl() });
      await inTransaction(this.db, "user", ctx.userId, (trx) =>
        trx
          .insertInto("app.payments")
          .values({
            order_id: order.id,
            provider: "mbiyopay",
            provider_payment_ref: started.transactionId,
            status: "pending",
            amount: order.amount,
            currency: price.currency,
            provider_status: started.status,
            fee: started.fee ? started.fee.toFixed(2) : null,
            next_action: JSON.stringify(started.next),
          })
          .execute(),
      );
      // Sandbox (et certains réseaux) : le résultat est parfois déjà connu.
      if (started.status !== "pending") await this.reconcile(started.transactionId);
    } catch (e) {
      if (!(e instanceof GatewayRejected)) {
        // Réseau coupé ou délai dépassé : la demande est peut-être partie. Le suivi relira par notre référence.
        this.logger.warn(`payin ${order.id} sans réponse : ${(e as Error).message}`);
        return this.order(ctx, order.id);
      }
      await inTransaction(this.db, "user", ctx.userId, async (trx) => {
        await trx.updateTable("app.orders").set({ status: "failed" }).where("id", "=", order.id).execute();
        await this.releaseCredit(trx, order.id);
      });
      throw new ApiException("PAYMENT_REJECTED", { reason: e.message });
    }
    return this.order(ctx, order.id);
  }

  async orders(ctx: Ctx): Promise<OrderResponse[]> {
    const rows = await this.orderRows(ctx.userId).orderBy("o.created_at", "desc").limit(100).execute();
    return rows.map((r) => this.toOrder(r));
  }

  async order(ctx: Ctx, id: string): Promise<OrderResponse> {
    let row = await this.orderRows(ctx.userId).where("o.id", "=", id).executeTakeFirst();
    if (!row) throw new ApiException("ORDER_NOT_FOUND");
    if (row.status === "pending" && this.gateway.mode !== "disabled") {
      const stale = !row.checkedAt || Date.now() - new Date(row.checkedAt).getTime() > RECHECK_MS;
      if (stale) {
        await this.reconcile(row.paymentRef ?? row.id).catch((e: unknown) => this.logger.warn(`suivi ${id} : ${(e as Error).message}`));
        row = (await this.orderRows(ctx.userId).where("o.id", "=", id).executeTakeFirst())!;
      }
    }
    return this.toOrder(row);
  }

  async finalizeOrder(ctx: Ctx, id: string, otp: string): Promise<OrderResponse> {
    this.requireGateway();
    const row = await this.orderRows(ctx.userId).where("o.id", "=", id).executeTakeFirst();
    if (!row) throw new ApiException("ORDER_NOT_FOUND");
    if (row.status !== "pending" || !row.paymentRef || (row.nextAction as PaymentNext | null)?.kind !== "pin") throw new ApiException("PAYMENT_NOT_PENDING");
    await this.finalize(row.paymentRef, otp);
    return this.order(ctx, id);
  }

  // -------------------------------------------------------------------
  // Cadeau d'argent : l'expéditeur paie (montant + frais)
  // -------------------------------------------------------------------

  async giftFunding(ctx: Ctx, experienceId: string, giftId: string): Promise<GiftFundingResponse> {
    const gift = await this.ownedMoneyGift(ctx.userId, experienceId, giftId);
    let transfer = await this.latestTransfer(gift.id, "funding");
    if (transfer && isOpen(transfer.status) && this.gateway.mode !== "disabled") {
      const stale = !transfer.checked_at || Date.now() - new Date(transfer.checked_at).getTime() > RECHECK_MS;
      if (stale) {
        await this.reconcile(transfer.provider_ref ?? transfer.id).catch((e: unknown) => this.logger.warn(`suivi cadeau ${gift.id} : ${(e as Error).message}`));
        transfer = await this.latestTransfer(gift.id, "funding");
      }
    }
    const fresh = await this.ownedMoneyGift(ctx.userId, experienceId, giftId);
    const rate = parseRate(await readSetting<unknown>(this.db, "payments.money_fee_rate", null));
    const fee = transfer ? transfer.fee : rate ? feeFor(fresh.amount, fresh.currency, rate) : "0.00";
    return {
      giftId: fresh.id,
      giftStatus: fresh.status,
      amount: fresh.amount,
      fee,
      total: fromCents(toCents(fresh.amount) + toCents(fee)),
      currency: fresh.currency,
      transfer: transfer
        ? {
            id: transfer.id,
            status: transfer.status,
            next: isOpen(transfer.status) ? (transfer.next_action as PaymentNext | null) : null,
            failureReason: transfer.failure_reason,
          }
        : null,
    };
  }

  async fundGift(ctx: Ctx, experienceId: string, giftId: string, payer: MobileMoneyAccount): Promise<GiftFundingResponse> {
    this.requireGateway();
    const rate = parseRate(await readSetting<unknown>(this.db, "payments.money_fee_rate", null));
    if (!rate) throw new ApiException("MONEY_FEES_NOT_CONFIGURED");

    const transfer = await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const gift = await this.lockOwnedMoneyGift(trx, ctx.userId, experienceId, giftId);
      if (gift.status !== "AWAITING_FUNDING") throw new ApiException("GIFT_NOT_FUNDABLE", { status: gift.status });
      const open = await trx
        .selectFrom("app.gift_transfers")
        .select("id")
        .where("gift_id", "=", gift.id)
        .where("direction", "=", "funding")
        .where("status", "in", ["initiated", "pending"])
        .executeTakeFirst();
      if (open) return null;
      const fee = feeFor(gift.amount, gift.currency, rate);
      const total = fromCents(toCents(gift.amount) + toCents(fee));
      const account = this.account(payer, gift.currency, total);
      const row = await trx
        .insertInto("app.gift_transfers")
        .values({
          gift_id: gift.id,
          owner_id: ctx.userId,
          direction: "funding",
          amount: total,
          fee,
          currency: gift.currency,
          country_code: payer.countryCode,
          network: payer.network,
          phone_last4: account.phoneNumber.slice(-4),
        })
        .returning(["id", "amount", "currency"])
        .executeTakeFirstOrThrow();
      await audit(trx, {
        actorType: "user",
        actorId: ctx.userId,
        action: "gift.funding_started",
        entityType: "gift",
        entityId: gift.id,
        data: { transferId: row.id, amount: total, fee, currency: gift.currency, network: payer.network },
        requestId: ctx.requestId,
      });
      return { ...row, account };
    });
    if (!transfer) return this.giftFunding(ctx, experienceId, giftId);

    try {
      const started = await this.gateway.payin({
        orderId: transfer.id,
        amount: Number(transfer.amount),
        currency: transfer.currency,
        ...transfer.account,
        callbackUrl: this.callbackUrl(),
      });
      await inTransaction(this.db, "user", ctx.userId, (trx) =>
        trx
          .updateTable("app.gift_transfers")
          .set({ provider_ref: started.transactionId, status: "pending", next_action: JSON.stringify(started.next) })
          .where("id", "=", transfer.id)
          .execute(),
      );
      if (started.status !== "pending") await this.reconcile(started.transactionId);
    } catch (e) {
      if (!(e instanceof GatewayRejected)) {
        this.logger.warn(`payin cadeau ${transfer.id} sans réponse : ${(e as Error).message}`);
        return this.giftFunding(ctx, experienceId, giftId);
      }
      await inTransaction(this.db, "user", ctx.userId, (trx) =>
        trx.updateTable("app.gift_transfers").set({ status: "failed", failure_reason: e.message }).where("id", "=", transfer.id).execute(),
      );
      throw new ApiException("PAYMENT_REJECTED", { reason: e.message });
    }
    return this.giftFunding(ctx, experienceId, giftId);
  }

  async finalizeGiftFunding(ctx: Ctx, experienceId: string, giftId: string, otp: string): Promise<GiftFundingResponse> {
    this.requireGateway();
    const gift = await this.ownedMoneyGift(ctx.userId, experienceId, giftId);
    const transfer = await this.latestTransfer(gift.id, "funding");
    if (!transfer || !isOpen(transfer.status) || !transfer.provider_ref || (transfer.next_action as PaymentNext | null)?.kind !== "pin") {
      throw new ApiException("PAYMENT_NOT_PENDING");
    }
    await this.finalize(transfer.provider_ref, otp);
    return this.giftFunding(ctx, experienceId, giftId);
  }

  // -------------------------------------------------------------------
  // Cadeau d'argent : le destinataire reçoit (sans compte)
  // -------------------------------------------------------------------

  async claimInfo(slug: string, giftId: string, code?: string): Promise<GiftClaimResponse> {
    let gift = await this.claimableGift(slug, giftId, code);
    let payout = await this.latestTransfer(gift.id, "payout");
    if (payout && isOpen(payout.status) && this.gateway.mode !== "disabled") {
      const stale = !payout.checked_at || Date.now() - new Date(payout.checked_at).getTime() > RECHECK_MS;
      if (stale) {
        await this.reconcile(payout.provider_ref ?? payout.id).catch((e: unknown) => this.logger.warn(`suivi envoi ${gift.id} : ${(e as Error).message}`));
        gift = await this.claimableGift(slug, giftId, code);
        payout = await this.latestTransfer(gift.id, "payout");
      }
    }
    const state: GiftClaimResponse["state"] =
      gift.status === "TRANSFERRED"
        ? "transferred"
        : gift.status === "TRANSFER_PENDING"
          ? "pending"
          : gift.status === "AWAITING_CLAIM" || gift.status === "FAILED"
            ? "claimable"
            : "unavailable";
    const locale = (gift.payload as { locale?: string } | null)?.locale === "en" ? "en" : "fr";
    return {
      locale,
      amount: gift.amount,
      currency: gift.currency,
      state,
      countries: countriesForCurrency(gift.currency),
      lastAttemptFailed: gift.status === "FAILED",
    };
  }

  async claim(slug: string, giftId: string, body: ClaimGiftRequest, requestId: string | null, code?: string): Promise<GiftClaimResponse> {
    this.requireGateway();
    const callbackUrl = this.callbackUrl();
    // L'envoi d'argent exige une adresse de webhook (documentation MbiyoPay).
    if (!callbackUrl) throw new ApiException("PAYMENTS_UNAVAILABLE");
    const found = await this.claimableGift(slug, giftId, code);
    const account = this.account(body.account, found.currency, found.amount);

    const transfer = await inTransaction(this.db, "system", null, async (trx) => {
      const gift = await trx
        .selectFrom("app.gifts")
        .select(["id", "owner_id", "status", "amount", "currency"])
        .where("id", "=", found.id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (gift.status !== "AWAITING_CLAIM" && gift.status !== "FAILED") throw new ApiException("GIFT_NOT_CLAIMABLE", { status: gift.status });
      await trx.updateTable("app.gifts").set({ status: "TRANSFER_PENDING" }).where("id", "=", gift.id).execute();
      const row = await trx
        .insertInto("app.gift_transfers")
        .values({
          gift_id: gift.id,
          owner_id: gift.owner_id,
          direction: "payout",
          amount: gift.amount!,
          currency: gift.currency!,
          country_code: body.account.countryCode,
          network: body.account.network,
          phone_last4: account.phoneNumber.slice(-4),
        })
        .returning(["id", "amount", "currency"])
        .executeTakeFirstOrThrow();
      await audit(trx, {
        actorType: "anonymous",
        action: "gift.claimed",
        entityType: "gift",
        entityId: gift.id,
        data: { transferId: row.id, amount: row.amount, currency: row.currency, network: body.account.network },
        requestId,
      });
      return row;
    });

    try {
      const started = await this.gateway.payout({
        orderId: transfer.id,
        amount: Number(transfer.amount),
        currency: transfer.currency,
        ...account,
        beneficiary: body.beneficiary,
        callbackUrl,
      });
      await inTransaction(this.db, "system", null, (trx) =>
        trx
          .updateTable("app.gift_transfers")
          .set({ provider_ref: started.transactionId, status: "pending", fee: started.fee.toFixed(2) })
          .where("id", "=", transfer.id)
          .execute(),
      );
      if (started.status !== "pending") await this.reconcile(started.transactionId);
    } catch (e) {
      if (!(e instanceof GatewayRejected)) {
        this.logger.warn(`payout ${transfer.id} sans réponse : ${(e as Error).message}`);
        return this.claimInfo(slug, giftId, code);
      }
      // Refus du prestataire = sa réponse : l'envoi échoue, le destinataire peut réessayer.
      await inTransaction(this.db, "provider", null, async (trx) => {
        await trx.updateTable("app.gift_transfers").set({ status: "failed", failure_reason: e.message }).where("id", "=", transfer.id).execute();
        await trx.updateTable("app.gifts").set({ status: "FAILED" }).where("id", "=", found.id).execute();
      });
      throw new ApiException("PAYMENT_REJECTED", { reason: e.message });
    }
    return this.claimInfo(slug, giftId, code);
  }

  // -------------------------------------------------------------------
  // Webhooks et rapprochement
  // -------------------------------------------------------------------

  /**
   * Webhook MbiyoPay. La signature est vérifiée et journalisée, mais ce n'est
   * qu'un signal : la transaction est relue chez MbiyoPay avant tout effet.
   * Un faux webhook ne peut donc que déclencher une vérification de plus.
   */
  async handleWebhook(rawBody: Buffer | undefined, body: unknown, signature: string | undefined): Promise<{ received: true }> {
    const payload = (body && typeof body === "object" ? body : {}) as { transaction_id?: unknown; status?: unknown; type?: unknown };
    const transactionId = typeof payload.transaction_id === "string" ? payload.transaction_id.slice(0, 120) : null;
    const signatureValid = this.gateway.verifySignature(rawBody, body, signature) === true;
    const eventId = transactionId ? `${transactionId}:${typeof payload.status === "string" ? payload.status.slice(0, 20) : "?"}` : null;

    const event = await this.db
      .insertInto("app.webhook_events")
      .values({
        provider: "mbiyopay",
        provider_event_id: eventId,
        event_type: typeof payload.type === "string" ? payload.type.slice(0, 40) : null,
        signature_valid: signatureValid && eventId !== null,
        payload: JSON.stringify(body ?? {}),
      })
      .onConflict((oc) => oc.columns(["provider", "provider_event_id"]).where("signature_valid", "=", true).doNothing())
      .returning("id")
      .executeTakeFirst();
    // Déjà reçu et authentique : rien à refaire.
    if (!event) return { received: true };
    if (!transactionId) {
      await this.db.updateTable("app.webhook_events").set({ processing_status: "ignored", processed_at: new Date() }).where("id", "=", event.id).execute();
      return { received: true };
    }
    try {
      const applied = await this.reconcile(transactionId);
      await this.db
        .updateTable("app.webhook_events")
        .set({ processing_status: applied ? "processed" : "ignored", processed_at: new Date(), attempts: 1 })
        .where("id", "=", event.id)
        .execute();
    } catch (e) {
      await this.db
        .updateTable("app.webhook_events")
        .set({ processing_status: "failed", attempts: 1, last_error: (e as Error).message.slice(0, 500) })
        .where("id", "=", event.id)
        .execute();
      throw e;
    }
    return { received: true };
  }

  /**
   * Relit une transaction chez le prestataire (par son identifiant ou par
   * notre référence) et applique son statut. Renvoie false si elle ne
   * correspond à rien chez nous.
   */
  async reconcile(reference: string): Promise<boolean> {
    const t = await this.gateway.transaction(reference);
    if (!t) {
      await this.forgetLost(reference);
      return false;
    }
    return this.apply(t, reference);
  }

  /** Demandes restées sans trace chez le prestataire : la demande n'est jamais partie. */
  private async forgetLost(reference: string) {
    if (!UUID.test(reference)) return;
    const cutoff = new Date(Date.now() - LOST_AFTER_MS);
    await inTransaction(this.db, "system", null, async (trx) => {
      const lostOrder = await trx
        .updateTable("app.orders")
        .set({ status: "failed" })
        .where("id", "=", reference)
        .where("status", "=", "pending")
        .where("created_at", "<", cutoff)
        .where((eb) => eb.not(eb.exists(eb.selectFrom("app.payments").select("id").where("order_id", "=", reference))))
        .returning("id")
        .executeTakeFirst();
      if (lostOrder) await this.releaseCredit(trx, reference);
      const lost = await trx
        .updateTable("app.gift_transfers")
        .set({ status: "failed", failure_reason: "no_provider_record" })
        .where("id", "=", reference)
        .where("status", "=", "initiated")
        .where("created_at", "<", cutoff)
        .returning(["gift_id", "direction"])
        .executeTakeFirst();
      // Un envoi jamais parti rend la main au destinataire.
      if (lost?.direction === "payout" && lost.gift_id) {
        await sql`select set_config('app.actor', 'provider', true)`.execute(trx);
        await trx.updateTable("app.gifts").set({ status: "FAILED" }).where("id", "=", lost.gift_id).where("status", "=", "TRANSFER_PENDING").execute();
      }
    });
  }

  private async apply(t: GatewayTransaction, reference: string): Promise<boolean> {
    const refs = [t.transactionId, reference].filter(Boolean);
    const ours = [t.orderId, reference].filter((x): x is string => typeof x === "string" && UUID.test(x));

    const payment = await this.db
      .selectFrom("app.payments")
      .select(["id", "order_id"])
      .where((eb) => eb.or([eb("provider_payment_ref", "in", refs), ...(ours.length ? [eb("order_id", "in", ours)] : [])]))
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    if (payment) return this.applyToOrder(t, payment.order_id);
    if (ours.length) {
      const order = await this.db.selectFrom("app.orders").select("id").where("id", "in", ours).executeTakeFirst();
      if (order) return this.applyToOrder(t, order.id);
    }
    const transfer = await this.db
      .selectFrom("app.gift_transfers")
      .select("id")
      .where((eb) => eb.or([eb("provider_ref", "in", refs), ...(ours.length ? [eb("id", "in", ours)] : [])]))
      .executeTakeFirst();
    if (transfer) return this.applyToTransfer(t, transfer.id);
    return false;
  }

  private async applyToOrder(t: GatewayTransaction, orderId: string): Promise<boolean> {
    const status = STATUS_OF[t.status];
    let paid: Array<{ id: string; threshold: number }> | null = null;
    const applied = await inTransaction(this.db, "provider", null, async (trx) => {
      const order = await trx.selectFrom("app.orders").selectAll().where("id", "=", orderId).forUpdate().executeTakeFirstOrThrow();
      let payment = await trx.selectFrom("app.payments").selectAll().where("order_id", "=", orderId).orderBy("created_at", "desc").forUpdate().executeTakeFirst();
      // La réponse au paiement s'était perdue : on rattache la transaction retrouvée.
      if (!payment && t.transactionId) {
        payment = await trx
          .insertInto("app.payments")
          .values({ order_id: orderId, provider: "mbiyopay", provider_payment_ref: t.transactionId, status: "pending", amount: order.amount, currency: order.currency })
          .returningAll()
          .executeTakeFirstOrThrow();
      }
      if (!payment) return false;
      const now = new Date();
      await trx.updateTable("app.payments").set({ provider_status: t.status, checked_at: now }).where("id", "=", payment.id).execute();
      if (!isOpen(payment.status) || order.status !== "pending" || status === "pending" || status === "initiated") return true;

      if (status === "succeeded") {
        const matches = t.currency === order.currency && toCents(t.amount.toFixed(2)) >= toCents(order.amount);
        await trx
          .updateTable("app.payments")
          .set({ status: "succeeded", confirmed_at: now, fee: t.fee.toFixed(2), next_action: null })
          .where("id", "=", payment.id)
          .execute();
        if (!matches) {
          // Montant ou devise inattendus : argent reçu, mais pas de licence sans examen.
          await trx.updateTable("app.orders").set({ status: "disputed", paid_at: now }).where("id", "=", orderId).execute();
          await audit(trx, {
            actorType: "provider",
            action: "order.amount_mismatch",
            entityType: "order",
            entityId: orderId,
            data: { expected: `${order.amount} ${order.currency}`, received: `${t.amount} ${t.currency}`, transactionId: t.transactionId },
          });
          return true;
        }
        await trx.updateTable("app.orders").set({ status: "paid", paid_at: now }).where("id", "=", orderId).execute();
        const license = await sql<{ id: string }>`select app.activate_purchase_license(${orderId}::uuid) as id`.execute(trx);
        paid = await this.referrals.onOrderPaid(trx, order.user_id, orderId);
        await audit(trx, {
          actorType: "provider",
          action: "order.paid",
          entityType: "order",
          entityId: orderId,
          data: { transactionId: t.transactionId, licenseId: license.rows[0]?.id ?? null, amount: order.amount, currency: order.currency },
        });
        return true;
      }

      await trx.updateTable("app.payments").set({ status, next_action: null }).where("id", "=", payment.id).execute();
      await this.releaseCredit(trx, orderId);
      await trx
        .updateTable("app.orders")
        .set({ status: (status === "cancelled" ? "cancelled" : "failed") satisfies OrderStatus })
        .where("id", "=", orderId)
        .execute();
      await audit(trx, { actorType: "provider", action: `order.${status}`, entityType: "order", entityId: orderId, data: { transactionId: t.transactionId } });
      return true;
    });
    if (paid) void this.afterPaid(orderId, paid);
    return applied;
  }

  /** Après validation en base : e-mails (jamais bloquants). */
  private async afterPaid(orderId: string, granted: Array<{ id: string; threshold: number }>) {
    try {
      await this.mail.orderPaid(orderId);
      for (const card of granted) await this.mail.giftCardGranted(card.id, card.threshold);
    } catch (e) {
      this.logger.warn(`e-mails après paiement ${orderId} : ${(e as Error).message}`);
    }
  }

  /** Réserve la carte cadeau (les plus anciennes d'abord) ; refuse si le solde a changé entre-temps. */
  private async spendCredit(trx: Tx, userId: string, orderId: string, currency: string, credit: string) {
    let left = toCents(credit);
    const cards = await trx
      .selectFrom("app.gift_cards")
      .select(["id", "balance"])
      .where("owner_id", "=", userId)
      .where("currency", "=", currency)
      .where("balance", ">", "0")
      .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", sql<Date>`now()`)]))
      .orderBy("created_at")
      .forUpdate()
      .execute();
    for (const card of cards) {
      if (left <= 0n) break;
      const take = toCents(card.balance) < left ? toCents(card.balance) : left;
      await trx.updateTable("app.gift_cards").set({ balance: fromCents(toCents(card.balance) - take) }).where("id", "=", card.id).execute();
      await trx.insertInto("app.gift_card_movements").values({ gift_card_id: card.id, order_id: orderId, amount: `-${fromCents(take)}`, kind: "spend" }).execute();
      left -= take;
    }
    if (left > 0n) throw new ApiException("ORDER_NOT_CREDIT_COVERED");
  }

  /** Paiement échoué ou annulé : la carte cadeau réservée est rendue (une seule fois). */
  private async releaseCredit(trx: Tx, orderId: string) {
    const moves = await trx.selectFrom("app.gift_card_movements").select(["gift_card_id", "amount"]).where("order_id", "=", orderId).execute();
    const net = new Map<string, bigint>();
    for (const m of moves) {
      const cents = m.amount.startsWith("-") ? -toCents(m.amount.slice(1)) : toCents(m.amount);
      net.set(m.gift_card_id, (net.get(m.gift_card_id) ?? 0n) + cents);
    }
    for (const [cardId, cents] of net) {
      if (cents >= 0n) continue;
      const back = -cents;
      const card = await trx.selectFrom("app.gift_cards").select("balance").where("id", "=", cardId).forUpdate().executeTakeFirstOrThrow();
      await trx.updateTable("app.gift_cards").set({ balance: fromCents(toCents(card.balance) + back) }).where("id", "=", cardId).execute();
      await trx.insertInto("app.gift_card_movements").values({ gift_card_id: cardId, order_id: orderId, amount: fromCents(back), kind: "release" }).execute();
    }
  }

  /**
   * Revérifie les paiements restés en attente (tâche périodique et bouton de
   * l'administration) : utile quand ni webhook ni visite de page n'arrive.
   */
  async reconcilePending(limit = 50): Promise<{ checked: number; settled: number }> {
    if (this.gateway.mode === "disabled") return { checked: 0, settled: 0 };
    const since = new Date(Date.now() - 48 * 3600_000);
    const quiet = new Date(Date.now() - 60_000);
    const orders = await this.db
      .selectFrom("app.orders as o")
      .leftJoin("app.payments as p", "p.order_id", "o.id")
      .select(["o.id", "p.provider_payment_ref as ref"])
      .where("o.status", "=", "pending")
      .where("o.provider", "=", "mbiyopay")
      .where("o.created_at", ">", since)
      .where((eb) => eb.or([eb("p.checked_at", "is", null), eb("p.checked_at", "<", quiet)]))
      .limit(limit)
      .execute();
    const transfers = await this.db
      .selectFrom("app.gift_transfers")
      .select(["id", "provider_ref as ref"])
      .where("status", "in", ["initiated", "pending"])
      .where("created_at", ">", since)
      .where((eb) => eb.or([eb("checked_at", "is", null), eb("checked_at", "<", quiet)]))
      .limit(limit)
      .execute();
    let settled = 0;
    for (const item of [...orders, ...transfers]) {
      try {
        const before = await this.statusOf(item.id);
        await this.reconcile(item.ref ?? item.id);
        if ((await this.statusOf(item.id)) !== before) settled++;
      } catch (e) {
        this.logger.warn(`revérification ${item.id} : ${(e as Error).message}`);
      }
    }
    return { checked: orders.length + transfers.length, settled };
  }

  private async statusOf(id: string): Promise<string | null> {
    const o = await this.db.selectFrom("app.orders").select("status").where("id", "=", id).executeTakeFirst();
    if (o) return o.status;
    const t = await this.db.selectFrom("app.gift_transfers").select("status").where("id", "=", id).executeTakeFirst();
    return t?.status ?? null;
  }

  private async applyToTransfer(t: GatewayTransaction, transferId: string): Promise<boolean> {
    const status = STATUS_OF[t.status];
    let transferred = false;
    const applied = await inTransaction(this.db, "provider", null, async (trx) => {
      const transfer = await trx.selectFrom("app.gift_transfers").selectAll().where("id", "=", transferId).forUpdate().executeTakeFirstOrThrow();
      const now = new Date();
      await trx
        .updateTable("app.gift_transfers")
        .set({ checked_at: now, ...(transfer.provider_ref ? {} : { provider_ref: t.transactionId }) })
        .where("id", "=", transferId)
        .execute();
      if (!isOpen(transfer.status) || status === "pending" || status === "initiated") return true;
      const gift = transfer.gift_id
        ? await trx.selectFrom("app.gifts").select(["id", "status"]).where("id", "=", transfer.gift_id).forUpdate().executeTakeFirst()
        : undefined;

      if (status === "succeeded") {
        if (transfer.direction === "funding" && (t.currency !== transfer.currency || toCents(t.amount.toFixed(2)) < toCents(transfer.amount))) {
          await audit(trx, {
            actorType: "provider",
            action: "gift.funding_amount_mismatch",
            entityType: "gift_transfer",
            entityId: transferId,
            data: { expected: `${transfer.amount} ${transfer.currency}`, received: `${t.amount} ${t.currency}` },
          });
          await trx.updateTable("app.gift_transfers").set({ status: "failed", failure_reason: "amount_mismatch" }).where("id", "=", transferId).execute();
          return true;
        }
        await trx
          .updateTable("app.gift_transfers")
          .set({ status: "succeeded", confirmed_at: now, next_action: null, ...(transfer.direction === "payout" ? { fee: t.fee.toFixed(2) } : {}) })
          .where("id", "=", transferId)
          .execute();
        if (gift && transfer.direction === "funding" && gift.status === "AWAITING_FUNDING") {
          await trx.updateTable("app.gifts").set({ status: "FUNDED" }).where("id", "=", gift.id).execute();
          // L'argent est là : le cadeau attend que le destinataire indique où le recevoir.
          await sql`select set_config('app.actor', 'system', true)`.execute(trx);
          await trx.updateTable("app.gifts").set({ status: "AWAITING_CLAIM" }).where("id", "=", gift.id).execute();
        }
        if (gift && transfer.direction === "payout" && gift.status === "TRANSFER_PENDING") {
          await trx.updateTable("app.gifts").set({ status: "TRANSFERRED" }).where("id", "=", gift.id).execute();
          transferred = true;
        }
        await audit(trx, {
          actorType: "provider",
          action: transfer.direction === "funding" ? "gift.funded" : "gift.transferred",
          entityType: "gift",
          entityId: transfer.gift_id,
          data: { transferId, transactionId: t.transactionId, amount: transfer.amount, currency: transfer.currency },
        });
        return true;
      }

      await trx.updateTable("app.gift_transfers").set({ status, next_action: null, failure_reason: `provider_${t.status}` }).where("id", "=", transferId).execute();
      // Envoi raté : MbiyoPay rembourse son solde ; le destinataire peut réessayer avec un autre numéro.
      if (gift && transfer.direction === "payout" && gift.status === "TRANSFER_PENDING") {
        await trx.updateTable("app.gifts").set({ status: "FAILED" }).where("id", "=", gift.id).execute();
      }
      await audit(trx, {
        actorType: "provider",
        action: transfer.direction === "funding" ? "gift.funding_failed" : "gift.transfer_failed",
        entityType: "gift",
        entityId: transfer.gift_id,
        data: { transferId, transactionId: t.transactionId },
      });
      return true;
    });
    if (transferred) void this.mail.giftTransferred(transferId).catch((e: unknown) => this.logger.warn(`e-mail transfert ${transferId} : ${(e as Error).message}`));
    return applied;
  }

  // -------------------------------------------------------------------
  // Outils
  // -------------------------------------------------------------------

  private async price(planCode: string, currency: string) {
    const price = await this.db
      .selectFrom("app.plan_prices as pp")
      .innerJoin("app.plans as p", "p.id", "pp.plan_id")
      .select(["p.id as planId", "pp.id as priceId", "pp.amount", "pp.currency"])
      .where("p.code", "=", planCode)
      .where("p.is_active", "=", true)
      .where("p.is_public", "=", true)
      .where("p.is_free", "=", false)
      .where("pp.currency", "=", currency)
      .where("pp.valid_from", "<=", sql<Date>`now()`)
      .where((eb) => eb.or([eb("pp.valid_to", "is", null), eb("pp.valid_to", ">", sql<Date>`now()`)]))
      .executeTakeFirst();
    if (!price) {
      const plan = await this.db.selectFrom("app.plans").select("id").where("code", "=", planCode).where("is_active", "=", true).executeTakeFirst();
      throw new ApiException(plan ? "PLAN_PRICE_NOT_FOUND" : "PLAN_NOT_FOUND", { planCode, currency });
    }
    return price;
  }

  /** Réduction de filleul (premier achat), puis carte cadeau (même devise), puis reste à payer. */
  private async pricing(db: Db | Tx, userId: string, listAmount: string, currency: string, useCredit: boolean) {
    const eligible = await this.referrals.isEligibleReferee(db, userId);
    const discountRate = eligible ? await this.referrals.refereeDiscountRate(db) : null;
    const discount = discountFor(listAmount, currency, discountRate);
    const query = db
      .selectFrom("app.gift_cards")
      .select(sql<string>`coalesce(sum(balance), 0)::text`.as("balance"))
      .where("owner_id", "=", userId)
      .where("currency", "=", currency)
      .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", sql<Date>`now()`)]));
    const { balance } = await query.executeTakeFirstOrThrow();
    const afterDiscount = toCents(listAmount) - toCents(discount);
    const balanceCents = toCents(Number(balance).toFixed(2));
    const credit = useCredit ? (balanceCents < afterDiscount ? balanceCents : afterDiscount) : 0n;
    return {
      discountRate,
      discount,
      balance: fromCents(balanceCents),
      credit: fromCents(credit),
      amount: fromCents(afterDiscount - credit),
    };
  }

  private requireGateway() {
    if (this.gateway.mode === "disabled") throw new ApiException("PAYMENTS_UNAVAILABLE");
  }

  private callbackUrl(): string | null {
    return this.env.PUBLIC_API_URL ? `${this.env.PUBLIC_API_URL.replace(/\/+$/, "")}/v1/webhooks/mbiyopay` : null;
  }

  /** Vérifie pays, devise et plafonds ; renvoie le compte au format attendu par le prestataire. */
  private account(a: MobileMoneyAccount, currency: string, amount: string) {
    const country = mobileMoneyCountry(a.countryCode);
    const limits = country?.currencies.find((c) => c.code === currency);
    if (!country || !limits) throw new ApiException("MOBILE_MONEY_CURRENCY_UNSUPPORTED", { countryCode: a.countryCode, currency });
    const value = Number(amount);
    if ((limits.min !== null && value < limits.min) || (limits.max !== null && value > limits.max)) {
      throw new ApiException("PAYMENT_AMOUNT_OUT_OF_RANGE", { min: limits.min, max: limits.max, currency });
    }
    return { countryCode: a.countryCode, network: a.network, phoneNumber: normalizePhone(a.countryCode, a.phoneNumber)! };
  }

  private async finalize(transactionId: string, otp: string) {
    try {
      await this.gateway.finalize(transactionId, otp);
    } catch (e) {
      if (e instanceof GatewayRejected) throw new ApiException("PAYMENT_REJECTED", { reason: e.message });
      throw e;
    }
  }

  private orderRows(userId: string) {
    return this.db
      .selectFrom("app.orders as o")
      .innerJoin("app.plans as p", "p.id", "o.plan_id")
      .leftJoin("app.licenses as l", "l.order_id", "o.id")
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom("app.payments")
            .select(["provider_payment_ref", "next_action", "failure_reason", "checked_at", "provider_status"])
            .whereRef("order_id", "=", "o.id")
            .orderBy("created_at", "desc")
            .limit(1)
            .as("pay"),
        (join) => join.onTrue(),
      )
      .select([
        "o.id",
        "o.status",
        "o.amount",
        "o.currency",
        "o.created_at as createdAt",
        "o.paid_at as paidAt",
        "o.list_amount as listAmount",
        "o.discount_amount as discountAmount",
        "o.credit_amount as creditAmount",
        "p.code as planCode",
        "p.name as planName",
        "l.id as licenseId",
        "pay.provider_payment_ref as paymentRef",
        "pay.next_action as nextAction",
        "pay.failure_reason as failureReason",
        "pay.checked_at as checkedAt",
        "pay.provider_status as providerStatus",
      ])
      .where("o.user_id", "=", userId);
  }

  private toOrder(r: {
    id: string;
    status: OrderStatus;
    amount: string;
    currency: string;
    createdAt: Date;
    paidAt: Date | null;
    listAmount: string | null;
    discountAmount: string;
    creditAmount: string;
    planCode: string;
    planName: string;
    licenseId: string | null;
    nextAction: Record<string, unknown> | null;
    failureReason: string | null;
    providerStatus: string | null;
  }): OrderResponse {
    return {
      id: r.id,
      status: r.status,
      plan: { code: r.planCode, name: r.planName },
      amount: r.amount,
      listAmount: r.listAmount,
      discountAmount: r.discountAmount,
      creditAmount: r.creditAmount,
      currency: r.currency,
      createdAt: toIso(r.createdAt)!,
      paidAt: toIso(r.paidAt),
      licenseId: r.licenseId,
      next: r.status === "pending" ? ((r.nextAction as PaymentNext | null) ?? { kind: "wait" }) : null,
      failureReason: r.status === "failed" || r.status === "cancelled" ? (r.failureReason ?? r.providerStatus) : null,
    };
  }

  private moneyGiftQuery(db: Db | Tx) {
    return db
      .selectFrom("app.gifts as g")
      .innerJoin("app.experiences as e", "e.id", "g.experience_id")
      .select(["g.id", "g.owner_id", "g.status", "g.amount", "g.currency", "g.data", "e.slug", "e.status as experienceStatus"])
      .where("g.gift_type", "=", "MONEY");
  }

  private async ownedMoneyGift(userId: string, experienceId: string, giftId: string) {
    const g = await this.moneyGiftQuery(this.db)
      .where("g.id", "=", giftId)
      .where("g.experience_id", "=", experienceId)
      .where("g.owner_id", "=", userId)
      .where("e.status", "!=", "deleted")
      .executeTakeFirst();
    if (!g || (g.data as { receptionMode?: string }).receptionMode !== "zaweli_transfer") throw new ApiException("GIFT_NOT_FOUND");
    return { ...g, amount: g.amount!, currency: g.currency! };
  }

  private async lockOwnedMoneyGift(trx: Tx, userId: string, experienceId: string, giftId: string) {
    const g = await trx
      .selectFrom("app.gifts")
      .select(["id", "status", "amount", "currency", "data"])
      .where("id", "=", giftId)
      .where("experience_id", "=", experienceId)
      .where("owner_id", "=", userId)
      .where("gift_type", "=", "MONEY")
      .forUpdate()
      .executeTakeFirst();
    if (!g || (g.data as { receptionMode?: string }).receptionMode !== "zaweli_transfer") throw new ApiException("GIFT_NOT_FOUND");
    return { ...g, amount: g.amount!, currency: g.currency! };
  }

  /** Cadeau d'argent d'une expérience publiée et ouverte (mêmes règles que la page publique : date, code). */
  private async claimableGift(slug: string, giftId: string, code?: string) {
    const g = await this.moneyGiftQuery(this.db)
      .innerJoin("app.experience_snapshots as s", "s.id", "e.current_snapshot_id")
      .select(["s.public_payload as payload", "e.access_code_hash as accessCodeHash", "e.available_from as availableFrom"])
      .where("e.slug", "=", slug)
      .where("g.id", "=", giftId)
      .where("e.status", "=", "published")
      .executeTakeFirst();
    if (!g || (g.data as { receptionMode?: string }).receptionMode !== "zaweli_transfer") throw new ApiException("NOT_FOUND");
    if (g.availableFrom && new Date(g.availableFrom).getTime() > Date.now()) throw new ApiException("NOT_YET_AVAILABLE");
    if (g.accessCodeHash && (!code || !verifyAccessCode(code, g.accessCodeHash))) throw new ApiException(code ? "ACCESS_CODE_INVALID" : "ACCESS_CODE_REQUIRED");
    return { ...g, amount: g.amount!, currency: g.currency! };
  }

  private latestTransfer(giftId: string, direction: "funding" | "payout") {
    return this.db
      .selectFrom("app.gift_transfers")
      .selectAll()
      .where("gift_id", "=", giftId)
      .where("direction", "=", direction)
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();
  }
}

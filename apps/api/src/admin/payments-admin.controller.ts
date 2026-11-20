import { Body, Controller, Get, HttpCode, Inject, Post, Put, Query, UseGuards } from "@nestjs/common";
import {
  type AdminOrderRow,
  type AdminPaymentSettingsRequest,
  type AdminPaymentSettingsResponse,
  adminPaymentSettingsSchema,
  type AdminPaymentsListQuery,
  adminPaymentsListSchema,
  type AdminReconcileResponse,
  type AdminReferrerRow,
  type AdminTransferRow,
} from "@zaweli/shared-types";
import { sql } from "kysely";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { Roles, RolesGuard } from "../auth/roles.guard.js";
import { ENV, type Env } from "../config/env.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction, readSetting, toIso } from "../database/transaction.js";
import { RequestId } from "../i18n/locale.js";
import { MobileMoneyGateway } from "../payments/mobile-money.gateway.js";
import { parseRate, PaymentsService } from "../payments/payments.service.js";
import { parseDiscountRate, ReferralsService } from "../referrals/referrals.service.js";

/**
 * Administration des paiements (docs/12, docs/13) : réglages (frais des
 * cadeaux d'argent, transferts ouverts, réduction de filleul, paliers de
 * parrainage), suivi des commandes et transferts, revérification manuelle.
 * Chaque réglage modifié est journalisé.
 */
@Controller("admin/payments")
@UseGuards(RolesGuard)
@Roles("admin")
export class PaymentsAdminController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly gateway: MobileMoneyGateway,
    private readonly payments: PaymentsService,
    private readonly referrals: ReferralsService,
  ) {}

  @Get("settings")
  async settings(): Promise<AdminPaymentSettingsResponse> {
    const [fee, enabled, discount, tiers] = await Promise.all([
      readSetting<unknown>(this.db, "payments.money_fee_rate", null),
      readSetting<boolean>(this.db, "gifts.money_transfers_enabled", false),
      readSetting<unknown>(this.db, "referrals.referee_discount_rate", null),
      this.referrals.tiers(),
    ]);
    return {
      mode: this.gateway.mode,
      webhookUrl: this.env.PUBLIC_API_URL ? `${this.env.PUBLIC_API_URL.replace(/\/+$/, "")}/v1/webhooks/mbiyopay` : null,
      moneyFeeRate: parseRate(fee)?.text ?? null,
      moneyTransfersEnabled: enabled === true,
      refereeDiscountRate: parseDiscountRate(discount),
      rewardTiers: tiers,
    };
  }

  @Put("settings")
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Body({ schema: adminPaymentSettingsSchema }) body: AdminPaymentSettingsRequest,
  ): Promise<AdminPaymentSettingsResponse> {
    const changes: Array<[string, unknown]> = [];
    if (body.moneyFeeRate !== undefined) changes.push(["payments.money_fee_rate", body.moneyFeeRate]);
    if (body.moneyTransfersEnabled !== undefined) changes.push(["gifts.money_transfers_enabled", body.moneyTransfersEnabled]);
    if (body.refereeDiscountRate !== undefined) changes.push(["referrals.referee_discount_rate", body.refereeDiscountRate]);
    if (body.rewardTiers !== undefined) changes.push(["referrals.reward_tiers", [...body.rewardTiers].sort((a, b) => a.threshold - b.threshold)]);
    await inTransaction(this.db, "admin", admin.id, async (trx) => {
      for (const [key, value] of changes) {
        await trx
          .insertInto("app.app_settings")
          .values({ key, value: JSON.stringify(value), updated_by: admin.id })
          .onConflict((oc) => oc.column("key").doUpdateSet({ value: JSON.stringify(value), updated_by: admin.id }))
          .execute();
        await audit(trx, { actorType: "admin", actorId: admin.id, action: "setting.updated", entityType: "app_setting", entityId: key, data: { value }, requestId });
      }
    });
    return this.settings();
  }

  @Get("orders")
  async orders(@Query({ schema: adminPaymentsListSchema }) q: AdminPaymentsListQuery): Promise<AdminOrderRow[]> {
    let query = this.db
      .selectFrom("app.orders as o")
      .innerJoin("app.plans as p", "p.id", "o.plan_id")
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom("app.payments")
            .select(["provider_payment_ref", "provider_status"])
            .whereRef("order_id", "=", "o.id")
            .orderBy("created_at", "desc")
            .limit(1)
            .as("pay"),
        (join) => join.onTrue(),
      )
      .select([
        "o.id",
        "o.created_at",
        "o.paid_at",
        "o.status",
        "p.name as plan",
        "o.amount",
        "o.list_amount",
        "o.discount_amount",
        "o.credit_amount",
        "o.currency",
        "o.country_code",
        "pay.provider_payment_ref as providerRef",
        "pay.provider_status as providerStatus",
      ])
      .orderBy("o.created_at", "desc")
      .limit(q.limit);
    if (q.status) query = query.where("o.status", "=", q.status as never);
    return (await query.execute()).map((r) => ({
      id: r.id,
      createdAt: toIso(r.created_at)!,
      paidAt: toIso(r.paid_at),
      status: r.status,
      plan: r.plan,
      amount: r.amount,
      listAmount: r.list_amount,
      discountAmount: r.discount_amount,
      creditAmount: r.credit_amount,
      currency: r.currency,
      countryCode: r.country_code,
      providerRef: r.providerRef,
      providerStatus: r.providerStatus,
    }));
  }

  @Get("transfers")
  async transfers(@Query({ schema: adminPaymentsListSchema }) q: AdminPaymentsListQuery): Promise<AdminTransferRow[]> {
    let query = this.db
      .selectFrom("app.gift_transfers as t")
      .leftJoin("app.gifts as g", "g.id", "t.gift_id")
      .select([
        "t.id",
        "t.created_at",
        "t.confirmed_at",
        "t.direction",
        "t.status",
        "t.amount",
        "t.fee",
        "t.currency",
        "t.country_code",
        "t.network",
        "t.phone_last4",
        "g.status as giftStatus",
        "t.provider_ref",
        "t.failure_reason",
      ])
      .orderBy("t.created_at", "desc")
      .limit(q.limit);
    if (q.status) query = query.where("t.status", "=", q.status as never);
    return (await query.execute()).map((r) => ({
      id: r.id,
      createdAt: toIso(r.created_at)!,
      confirmedAt: toIso(r.confirmed_at),
      direction: r.direction,
      status: r.status,
      amount: r.amount,
      fee: r.fee,
      currency: r.currency,
      countryCode: r.country_code,
      network: r.network,
      phoneLast4: r.phone_last4,
      giftStatus: r.giftStatus,
      providerRef: r.provider_ref,
      failureReason: r.failure_reason,
    }));
  }

  @Post("reconcile")
  @HttpCode(200)
  async reconcile(@CurrentUser() admin: AuthenticatedUser, @RequestId() requestId: string | null): Promise<AdminReconcileResponse> {
    const result = await this.payments.reconcilePending(100);
    await audit(this.db, { actorType: "admin", actorId: admin.id, action: "payments.reconciled", entityType: "payment", data: result, requestId });
    return result;
  }

  @Get("referrers")
  async referrers(): Promise<AdminReferrerRow[]> {
    const rows = await this.db
      .selectFrom("app.referrals as r")
      .leftJoin("app.profiles as p", "p.id", "r.referrer_id")
      .select([
        "r.referrer_id",
        "p.display_name",
        "p.referral_code",
        sql<number>`count(*) filter (where r.qualified_at is not null)::int`.as("qualified"),
        sql<number>`count(*) filter (where r.qualified_at is null)::int`.as("pending"),
        sql<number>`(select count(*)::int from app.gift_cards c where c.owner_id = r.referrer_id and c.source = 'referral')`.as("cards"),
      ])
      .groupBy(["r.referrer_id", "p.display_name", "p.referral_code"])
      .orderBy("qualified", "desc")
      .limit(100)
      .execute();
    return rows.map((r) => ({ referrerId: r.referrer_id, displayName: r.display_name, code: r.referral_code, qualified: r.qualified, pending: r.pending, cardsGranted: r.cards }));
  }
}

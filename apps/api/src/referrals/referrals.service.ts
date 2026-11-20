import { randomInt } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { type ReferralSummaryResponse, type RewardTier, rewardTierSchema } from "@zaweli/shared-types";
import { sql } from "kysely";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, readSetting, type Tx, toIso } from "../database/transaction.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
/** Un compte ne peut se déclarer filleul que dans ses premiers jours. */
const ATTACH_WINDOW_DAYS = 7;

/** Taux décimal « 0.2 » valide, sinon null. */
export function parseDiscountRate(value: unknown): string | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^(0(\.\d{1,6})?|1(\.0{1,6})?)$/.test(text) && Number(text) > 0 ? text : null;
}

/**
 * Parrainage (docs/13). Le parrainage ne rapporte qu'au premier achat payé
 * du filleul : un faux compte ne donne rien. Les paliers accordent une carte
 * cadeau une seule fois (unicité owner + « referral:<seuil> » en base).
 */
@Injectable()
export class ReferralsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async tiers(db: Db | Tx = this.db): Promise<RewardTier[]> {
    const raw = await readSetting<unknown>(db, "referrals.reward_tiers", []);
    const parsed = rewardTierSchema.array().safeParse(raw);
    return parsed.success ? [...parsed.data].sort((a, b) => a.threshold - b.threshold) : [];
  }

  async refereeDiscountRate(db: Db | Tx = this.db): Promise<string | null> {
    return parseDiscountRate(await readSetting<unknown>(db, "referrals.referee_discount_rate", null));
  }

  /** Code du compte, créé à la première demande. */
  async codeFor(userId: string): Promise<string> {
    const row = await this.db.selectFrom("app.profiles").select("referral_code").where("id", "=", userId).executeTakeFirst();
    if (row?.referral_code) return row.referral_code;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const updated = await this.db
          .updateTable("app.profiles")
          .set({ referral_code: newCode() })
          .where("id", "=", userId)
          .where("referral_code", "is", null)
          .returning("referral_code")
          .executeTakeFirst();
        if (updated?.referral_code) return updated.referral_code;
        const again = await this.db.selectFrom("app.profiles").select("referral_code").where("id", "=", userId).executeTakeFirst();
        if (again?.referral_code) return again.referral_code;
        throw new ApiException("NOT_FOUND");
      } catch (e) {
        // Collision de code (unicité) : on retente avec un autre.
        if ((e as { code?: string }).code !== "23505") throw e;
      }
    }
    throw new ApiException("INTERNAL_ERROR");
  }

  async summary(userId: string): Promise<ReferralSummaryResponse> {
    const code = await this.codeFor(userId);
    const [counts, tiers, cards, rate] = await Promise.all([
      this.db
        .selectFrom("app.referrals")
        .select([sql<number>`count(*) filter (where qualified_at is not null)::int`.as("qualified"), sql<number>`count(*) filter (where qualified_at is null)::int`.as("pending")])
        .where("referrer_id", "=", userId)
        .executeTakeFirstOrThrow(),
      this.tiers(),
      this.giftCards(userId),
      this.refereeDiscountRate(),
    ]);
    return {
      code,
      qualified: counts.qualified,
      pending: counts.pending,
      tiers: tiers.map((t) => ({ ...t, reached: counts.qualified >= t.threshold })),
      giftCards: cards,
      refereeDiscountRate: rate,
    };
  }

  async giftCards(userId: string) {
    const rows = await this.db
      .selectFrom("app.gift_cards")
      .select(["id", "amount", "balance", "currency", "source", "created_at", "expires_at"])
      .where("owner_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      balance: r.balance,
      currency: r.currency,
      source: r.source,
      createdAt: toIso(r.created_at)!,
      expiresAt: toIso(r.expires_at),
    }));
  }

  /**
   * Rattache un nouveau compte à son parrain (code reçu par le lien). Une
   * seule fois, dans les premiers jours, avant tout achat, jamais à soi-même.
   */
  async attach(userId: string, code: string, requestId: string | null): Promise<void> {
    const referrer = await this.db.selectFrom("app.profiles").select("id").where("referral_code", "=", code).executeTakeFirst();
    if (!referrer) throw new ApiException("REFERRAL_CODE_INVALID");
    if (referrer.id === userId) throw new ApiException("REFERRAL_NOT_ALLOWED");
    const me = await this.db
      .selectFrom("app.profiles")
      .select(["created_at"])
      .where("id", "=", userId)
      .executeTakeFirst();
    const tooOld = !me || Date.now() - new Date(me.created_at).getTime() > ATTACH_WINDOW_DAYS * 86_400_000;
    const paid = await this.db.selectFrom("app.orders").select("id").where("user_id", "=", userId).where("status", "=", "paid").executeTakeFirst();
    if (tooOld || paid) throw new ApiException("REFERRAL_NOT_ALLOWED");
    const inserted = await this.db
      .insertInto("app.referrals")
      .values({ referee_id: userId, referrer_id: referrer.id })
      .onConflict((oc) => oc.column("referee_id").doNothing())
      .returning("referee_id")
      .executeTakeFirst();
    if (!inserted) throw new ApiException("REFERRAL_NOT_ALLOWED");
    await audit(this.db, { actorType: "user", actorId: userId, action: "referral.attached", entityType: "referral", entityId: userId, data: { referrerId: referrer.id }, requestId });
  }

  /** Le filleul n'a encore rien payé et a un parrain : réduction possible. */
  async isEligibleReferee(db: Db | Tx, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("app.referrals as r")
      .select("r.referee_id")
      .where("r.referee_id", "=", userId)
      .where((eb) => eb.not(eb.exists(eb.selectFrom("app.orders").select("id").where("user_id", "=", userId).where("status", "in", ["paid", "disputed", "refunded"]))))
      .executeTakeFirst();
    return Boolean(row);
  }

  /**
   * Après le PREMIER achat payé du filleul (dans la transaction qui le
   * confirme) : le parrainage est qualifié, et chaque palier atteint donne
   * au parrain sa carte cadeau, une seule fois.
   */
  async onOrderPaid(trx: Tx, userId: string, orderId: string): Promise<Array<{ id: string; threshold: number }>> {
    const qualified = await trx
      .updateTable("app.referrals")
      .set({ qualified_at: new Date(), qualifying_order_id: orderId })
      .where("referee_id", "=", userId)
      .where("qualified_at", "is", null)
      .returning("referrer_id")
      .executeTakeFirst();
    if (!qualified) return [];
    const { count } = await trx
      .selectFrom("app.referrals")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("referrer_id", "=", qualified.referrer_id)
      .where("qualified_at", "is not", null)
      .executeTakeFirstOrThrow();
    const granted: Array<{ id: string; threshold: number }> = [];
    for (const tier of await this.tiers(trx)) {
      if (count < tier.threshold) continue;
      const card = await trx
        .insertInto("app.gift_cards")
        .values({
          owner_id: qualified.referrer_id,
          amount: tier.amount,
          balance: tier.amount,
          currency: tier.currency,
          source: "referral",
          source_ref: `referral:${tier.threshold}`,
        })
        .onConflict((oc) => oc.columns(["owner_id", "source_ref"]).doNothing())
        .returning("id")
        .executeTakeFirst();
      if (card) {
        granted.push({ id: card.id, threshold: tier.threshold });
        await audit(trx, {
          actorType: "system",
          action: "gift_card.granted",
          entityType: "gift_card",
          entityId: card.id,
          data: { ownerId: qualified.referrer_id, threshold: tier.threshold, amount: tier.amount, currency: tier.currency },
        });
      }
    }
    return granted;
  }
}

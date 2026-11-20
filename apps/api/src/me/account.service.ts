import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "kysely";
import { ApiException } from "../common/api-exception.js";
import { ENV, type Env } from "../config/env.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction, toIso } from "../database/transaction.js";
import { StorageService } from "../media/storage.service.js";

/** Administration des comptes Supabase Auth (clé secrète, côté serveur). Abstraite pour les tests. */
export abstract class AuthAdmin {
  abstract readonly available: boolean;
  abstract deleteUser(userId: string): Promise<void>;
  /** Compte gardé pour les pièces comptables : adresse remplacée, connexion bloquée. */
  abstract anonymizeUser(userId: string): Promise<void>;
}

@Injectable()
export class SupabaseAuthAdmin extends AuthAdmin {
  readonly available: boolean;
  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    this.available = Boolean(env.SUPABASE_SECRET_KEY);
  }
  async deleteUser(userId: string) {
    await this.call("DELETE", userId);
  }
  async anonymizeUser(userId: string) {
    await this.call("PUT", userId, { email: `supprime-${userId}@comptes-supprimes.zaweli.store`, user_metadata: {}, ban_duration: "876000h" });
  }
  private async call(method: "DELETE" | "PUT", userId: string, body?: unknown) {
    const key = this.env.SUPABASE_SECRET_KEY!;
    const res = await fetch(`${this.env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/admin/users/${userId}`, {
      method,
      headers: { authorization: `Bearer ${key}`, apikey: key, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 404) throw new Error(`auth admin ${method} → ${res.status}`);
  }
}

/** Statuts d'un cadeau d'argent dont l'argent est encore en jeu. */
const MONEY_IN_FLIGHT = ["FUNDED", "AWAITING_CLAIM", "TRANSFER_PENDING", "FAILED"];

/**
 * Données du compte (cahier des charges §7.2 : export et suppression).
 *
 * Suppression : tout le contenu personnel disparaît (expériences, liens
 * publics, destinataires, photos). S'il existe des commandes, le compte
 * est anonymisé et bloqué plutôt que supprimé (pièces comptables, §8.6).
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger("Account");

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly authAdmin: AuthAdmin,
    private readonly storage: StorageService,
  ) {}

  async export(userId: string, email: string | null) {
    const [profile, recipients, experiences, gifts, orders, licenses, giftCards, referrals] = await Promise.all([
      this.db
        .selectFrom("app.profiles")
        .select(["display_name", "locale", "marketing_opt_in", "notify_license_expiry", "country_code", "country_source", "referral_code", "created_at"])
        .where("id", "=", userId)
        .executeTakeFirst(),
      this.db.selectFrom("app.recipients").select(["id", "display_name", "contact_email", "contact_phone", "note", "created_at"]).where("owner_id", "=", userId).where("deleted_at", "is", null).execute(),
      this.db
        .selectFrom("app.experiences")
        .select(["id", "title", "status", "locale", "slug", "content", "disabled_sections", "music", "available_from", "first_published_at", "last_published_at", "created_at"])
        .where("owner_id", "=", userId)
        .where("status", "!=", "deleted")
        .execute(),
      this.db.selectFrom("app.gifts").select(["id", "experience_id", "gift_type", "status", "data", "amount", "currency"]).where("owner_id", "=", userId).execute(),
      this.db
        .selectFrom("app.orders as o")
        .innerJoin("app.plans as p", "p.id", "o.plan_id")
        .select(["o.id", "p.name as plan", "o.status", "o.amount", "o.list_amount", "o.discount_amount", "o.credit_amount", "o.currency", "o.created_at", "o.paid_at"])
        .where("o.user_id", "=", userId)
        .execute(),
      this.db
        .selectFrom("app.licenses as l")
        .innerJoin("app.plans as p", "p.id", "l.plan_id")
        .select(["l.id", "p.name as plan", "l.status", "l.source", "l.starts_at", "l.ends_at", "l.publications_used", "l.publications_max"])
        .where("l.user_id", "=", userId)
        .execute(),
      this.db.selectFrom("app.gift_cards").select(["id", "amount", "balance", "currency", "source", "created_at"]).where("owner_id", "=", userId).execute(),
      this.db.selectFrom("app.referrals").select(sql<number>`count(*)::int`.as("count")).where("referrer_id", "=", userId).executeTakeFirst(),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account: { id: userId, email, ...profile, created_at: toIso(profile?.created_at ?? null) },
      recipients,
      experiences,
      gifts,
      orders,
      licenses,
      giftCards,
      referrals: { count: referrals?.count ?? 0 },
    };
  }

  async delete(userId: string, requestId: string | null): Promise<void> {
    if (!this.authAdmin.available) throw new ApiException("SERVICE_UNAVAILABLE");
    const money = await this.db
      .selectFrom("app.gifts")
      .select("id")
      .where("owner_id", "=", userId)
      .where("gift_type", "=", "MONEY")
      .where("status", "in", MONEY_IN_FLIGHT)
      .executeTakeFirst();
    // De l'argent versé attend un destinataire : on ne le fait pas disparaître avec le compte.
    if (money) throw new ApiException("ACCOUNT_HAS_PENDING_MONEY");

    const media = await this.db.selectFrom("app.media_assets").select(["variants", "published_variants"]).where("owner_id", "=", userId).execute();
    const { orders } = await this.db.selectFrom("app.orders").select(sql<number>`count(*)::int`.as("orders")).where("user_id", "=", userId).executeTakeFirstOrThrow();

    await inTransaction(this.db, "system", userId, async (trx) => {
      const now = new Date();
      await trx
        .updateTable("app.experiences")
        .set({ status: "deleted", deleted_at: now, status_changed_at: now, content: JSON.stringify({ fields: {} }) })
        .where("owner_id", "=", userId)
        .where("status", "!=", "deleted")
        .execute();
      await trx
        .updateTable("app.recipients")
        .set({ display_name: "—", contact_email: null, contact_phone: null, note: null, deleted_at: now })
        .where("owner_id", "=", userId)
        .execute();
      await trx.updateTable("app.media_assets").set({ status: "deleted", deleted_at: now }).where("owner_id", "=", userId).execute();
      await trx
        .updateTable("app.profiles")
        .set({ display_name: null, marketing_opt_in: false, notify_license_expiry: false, referral_code: null, country_code: null, country_source: null, deleted_at: now })
        .where("id", "=", userId)
        .execute();
      await audit(trx, { actorType: "user", actorId: userId, action: "account.deleted", entityType: "account", entityId: userId, data: { keptForAccounting: orders > 0 }, requestId });
    });

    // Fichiers : variantes privées et copies publiques (les liens publics cessent de fonctionner).
    const privatePaths = media.flatMap((m) => Object.values(m.variants ?? {}));
    const publicPaths = media.flatMap((m) => Object.values(m.published_variants ?? {}).map((url) => url.split("/object/public/published/")[1]).filter((p): p is string => Boolean(p)));
    await this.storage.remove("media", privatePaths).catch((e: unknown) => this.logger.warn(`suppression photos privées : ${(e as Error).message}`));
    await this.storage.remove("published", publicPaths).catch((e: unknown) => this.logger.warn(`suppression photos publiques : ${(e as Error).message}`));

    if (orders > 0) await this.authAdmin.anonymizeUser(userId);
    else await this.authAdmin.deleteUser(userId);
  }
}

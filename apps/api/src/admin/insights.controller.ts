import { Body, Controller, Get, HttpCode, Inject, Post, Put, Query, UseGuards } from "@nestjs/common";
import {
  type AdminAuditFacetsResponse,
  type AdminAuditQuery,
  type AdminAuditResponse,
  type AdminCalendarResponse,
  type AdminExchangeRateRequest,
  type AdminExchangeRatesResponse,
  type AdminGeoResponse,
  type AdminOverviewResponse,
  type AdminSubscriptionsResponse,
  type AdminTimeseriesResponse,
  adminAuditQuerySchema,
  adminExchangeRateSchema,
  adminReferenceCurrencySchema,
  type InsightsCalendarQuery,
  insightsCalendarSchema,
  type InsightsRange,
  insightsRangeSchema,
  type InsightsTimeseriesQuery,
  insightsTimeseriesSchema,
} from "@zaweli/shared-types";
import { sql } from "kysely";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { Roles, RolesGuard } from "../auth/roles.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction, toIso } from "../database/transaction.js";
import { RequestId } from "../i18n/locale.js";
import { InsightsService } from "./insights.service.js";

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "23505";

/**
 * Tableau de bord de l'administration : statistiques mondiales, journal
 * d'audit (lecture seule) et taux de change. Rôle `admin` lu en base.
 * Les écritures (taux, devise de référence) sont journalisées.
 */
@Controller("admin")
@UseGuards(RolesGuard)
@Roles("admin")
export class InsightsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(InsightsService) private readonly insights: InsightsService,
  ) {}

  @Get("insights/overview")
  overview(@Query({ schema: insightsRangeSchema }) range: InsightsRange): Promise<AdminOverviewResponse> {
    return this.insights.overview(range);
  }

  @Get("insights/timeseries")
  timeseries(@Query({ schema: insightsTimeseriesSchema }) query: InsightsTimeseriesQuery): Promise<AdminTimeseriesResponse> {
    return this.insights.timeseries(query);
  }

  @Get("insights/geo")
  geo(@Query({ schema: insightsRangeSchema }) range: InsightsRange): Promise<AdminGeoResponse> {
    return this.insights.geo(range);
  }

  @Get("insights/subscriptions")
  subscriptions(): Promise<AdminSubscriptionsResponse> {
    return this.insights.subscriptions();
  }

  @Get("insights/calendar")
  calendar(@Query({ schema: insightsCalendarSchema }) query: InsightsCalendarQuery): Promise<AdminCalendarResponse> {
    return this.insights.calendar(query.month, query.tz);
  }

  // ------------------------------- Audit -------------------------------

  /** Journal d'audit, du plus récent au plus ancien, filtrable, paginé par curseur. Jamais modifiable. */
  @Get("audit")
  async auditLog(@Query({ schema: adminAuditQuerySchema }) q: AdminAuditQuery): Promise<AdminAuditResponse> {
    let query = this.db
      .selectFrom("app.audit_log")
      .select(["id", "occurred_at", "actor_type", "actor_id", "action", "entity_type", "entity_id", "data", "request_id"])
      .orderBy("id", "desc")
      .limit(q.limit + 1);
    if (q.action) query = query.where("action", "=", q.action);
    if (q.actorType) query = query.where("actor_type", "=", q.actorType);
    if (q.entityType) query = query.where("entity_type", "=", q.entityType);
    if (q.actorId) query = query.where("actor_id", "=", q.actorId);
    if (q.entityId) query = query.where("entity_id", "=", q.entityId);
    if (q.from) query = query.where("occurred_at", ">=", sql<Date>`cast(${q.from} as date)::timestamptz`);
    if (q.to) query = query.where("occurred_at", "<", sql<Date>`(cast(${q.to} as date) + 1)::timestamptz`);
    if (q.cursor) query = query.where("id", "<", q.cursor);
    const rows = await query.execute();
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => ({
        id: String(r.id),
        occurredAt: toIso(r.occurred_at)!,
        actorType: r.actor_type,
        actorId: r.actor_id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        data: typeof r.data === "string" ? (JSON.parse(r.data) as Record<string, unknown>) : r.data,
        requestId: r.request_id,
      })),
      nextCursor: rows.length > q.limit ? String(page.at(-1)!.id) : null,
    };
  }

  /** Valeurs présentes dans le journal, pour les filtres. */
  @Get("audit/facets")
  async auditFacets(): Promise<AdminAuditFacetsResponse> {
    const [actions, entities] = await Promise.all([
      this.db.selectFrom("app.audit_log").select("action").distinct().orderBy("action").limit(500).execute(),
      this.db.selectFrom("app.audit_log").select("entity_type").distinct().orderBy("entity_type").limit(500).execute(),
    ]);
    return { actions: actions.map((a) => a.action), entityTypes: entities.map((e) => e.entity_type) };
  }

  // ---------------------------- Taux de change ----------------------------

  @Get("exchange-rates")
  async exchangeRates(): Promise<AdminExchangeRatesResponse> {
    const referenceCurrency = await this.insights.referenceCurrency();
    const rows = await this.db
      .selectFrom("app.exchange_rates")
      .select(["id", "currency", "reference_currency", sql<string>`rate::text`.as("rate"), sql<string>`valid_from::text`.as("valid_from"), "created_at"])
      .orderBy("valid_from", "desc")
      .orderBy("currency")
      .limit(500)
      .execute();
    return {
      referenceCurrency,
      rates: rows.map((r) => ({
        id: r.id,
        currency: r.currency,
        referenceCurrency: r.reference_currency,
        rate: r.rate,
        validFrom: r.valid_from,
        createdAt: toIso(r.created_at)!,
      })),
    };
  }

  /** Nouveau taux daté (vers la devise de référence actuelle). Les taux passés ne changent jamais. */
  @Post("exchange-rates")
  async addExchangeRate(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Body({ schema: adminExchangeRateSchema }) body: AdminExchangeRateRequest,
  ): Promise<AdminExchangeRatesResponse> {
    const referenceCurrency = await this.insights.referenceCurrency();
    if (body.currency === referenceCurrency) throw new ApiException("VALIDATION_FAILED", { currency: "devise de référence : son taux vaut toujours 1" });
    try {
      await inTransaction(this.db, "admin", admin.id, async (trx) => {
        const row = await trx
          .insertInto("app.exchange_rates")
          .values({ currency: body.currency, reference_currency: referenceCurrency, rate: body.rate, valid_from: body.validFrom, created_by: admin.id })
          .returning("id")
          .executeTakeFirstOrThrow();
        await audit(trx, {
          actorType: "admin",
          actorId: admin.id,
          action: "exchange_rate.created",
          entityType: "exchange_rate",
          entityId: row.id,
          data: { currency: body.currency, referenceCurrency, rate: body.rate, validFrom: body.validFrom },
          requestId,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiException("EXCHANGE_RATE_EXISTS");
      throw error;
    }
    return this.exchangeRates();
  }

  /** Devise dans laquelle les totaux sont exprimés. Les taux saisis pour une autre référence sont conservés. */
  @Put("exchange-rates/reference")
  @HttpCode(200)
  async setReferenceCurrency(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Body({ schema: adminReferenceCurrencySchema }) body: { currency: string },
  ): Promise<AdminExchangeRatesResponse> {
    const previous = await this.insights.referenceCurrency();
    await inTransaction(this.db, "admin", admin.id, async (trx) => {
      await trx
        .insertInto("app.app_settings")
        .values({ key: "finance.reference_currency", value: JSON.stringify(body.currency) })
        .onConflict((oc) => oc.column("key").doUpdateSet({ value: JSON.stringify(body.currency) }))
        .execute();
      await audit(trx, {
        actorType: "admin",
        actorId: admin.id,
        action: "settings.reference_currency_changed",
        entityType: "app_setting",
        entityId: "finance.reference_currency",
        data: { from: previous, to: body.currency },
        requestId,
      });
    });
    return this.exchangeRates();
  }
}

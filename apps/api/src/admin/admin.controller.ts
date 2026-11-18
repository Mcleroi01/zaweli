import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  type AdminPlanRequest,
  adminGrantLicenseSchema,
  adminPlanSchema,
  adminPlanUpdateSchema,
  adminPriceSchema,
  adminTemplateUpdateSchema,
  resolveReportSchema,
  suspendExperienceSchema,
} from "@zaweli/shared-types";
import { sql } from "kysely";
import { z } from "zod";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { Roles, RolesGuard } from "../auth/roles.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction, type Tx, toIso } from "../database/transaction.js";
import { RequestId } from "../i18n/locale.js";

const id = z.uuid();
const planCode = z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/);
const slug = z.string().regex(/^[a-z0-9-]{2,40}$/);

/**
 * Administration réduite du MVP (cahier des charges §11.9). Rôle `admin`
 * lu en base. Chaque geste est fait sous l'acteur « admin » et journalisé.
 * Le design et le code des templates ne s'éditent JAMAIS d'ici.
 */
@Controller("admin")
@UseGuards(RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // ------------------------------- Modération -------------------------------

  @Get("reports")
  async reports(@Query("status", { schema: z.enum(["open", "dismissed", "actioned"]).default("open") }) status: "open" | "dismissed" | "actioned") {
    const rows = await this.db
      .selectFrom("app.reports as r")
      .innerJoin("app.experiences as e", "e.id", "r.experience_id")
      .select(["r.id", "r.reason", "r.details", "r.status", "r.created_at", "r.resolution", "e.id as experience_id", "e.slug", "e.status as experience_status"])
      .where("r.status", "=", status)
      .orderBy("r.created_at")
      .limit(200)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: toIso(r.created_at),
      resolution: r.resolution,
      experience: { id: r.experience_id, slug: r.slug, status: r.experience_status },
    }));
  }

  @Post("reports/:id/resolve")
  @HttpCode(200)
  async resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) reportId: string,
    @Body({ schema: resolveReportSchema }) body: z.infer<typeof resolveReportSchema>,
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const report = await trx.selectFrom("app.reports").select(["id", "status", "experience_id"]).where("id", "=", reportId).forUpdate().executeTakeFirst();
      if (!report) throw new ApiException("REPORT_NOT_FOUND");
      if (report.status !== "open") throw new ApiException("REPORT_ALREADY_HANDLED");
      if (body.action === "suspend") await this.suspendIn(trx, admin.id, report.experience_id, body.resolution ?? "report", requestId);
      await trx
        .updateTable("app.reports")
        .set({ status: body.action === "suspend" ? "actioned" : "dismissed", handled_by: admin.id, handled_at: new Date(), resolution: body.resolution ?? null })
        .where("id", "=", reportId)
        .execute();
      await audit(trx, { actorType: "admin", actorId: admin.id, action: `report.${body.action}`, entityType: "report", entityId: reportId, requestId });
      return { id: reportId, status: body.action === "suspend" ? "actioned" : "dismissed" };
    });
  }

  @Post("experiences/:id/suspend")
  @HttpCode(200)
  suspend(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) experienceId: string,
    @Body({ schema: suspendExperienceSchema }) body: { reason: string },
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      await this.suspendIn(trx, admin.id, experienceId, body.reason, requestId);
      return { id: experienceId, status: "suspended" };
    });
  }

  @Post("experiences/:id/unsuspend")
  @HttpCode(200)
  unsuspend(@CurrentUser() admin: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) experienceId: string) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const updated = await trx
        .updateTable("app.experiences")
        .set({ status: "published", suspension_reason: null, status_changed_at: new Date() })
        .where("id", "=", experienceId)
        .where("status", "=", "suspended")
        .executeTakeFirst();
      if (!updated.numUpdatedRows) throw new ApiException("EXPERIENCE_STATUS_CONFLICT");
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "experience.unsuspended", entityType: "experience", entityId: experienceId, requestId });
      return { id: experienceId, status: "published" };
    });
  }

  // -------------------------------- Formules --------------------------------

  @Get("plans")
  async plans() {
    const plans = await this.db.selectFrom("app.plans").selectAll().orderBy("position").execute();
    const prices = await this.db
      .selectFrom("app.plan_prices")
      .select(["plan_id", "currency", sql<string>`amount::text`.as("amount"), "valid_from", "valid_to"])
      .orderBy("valid_from", "desc")
      .execute();
    return plans.map((p) => ({ ...p, prices: prices.filter((x) => x.plan_id === p.id) }));
  }

  @Post("plans")
  async createPlan(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Body({ schema: adminPlanSchema }) body: AdminPlanRequest,
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const row = await trx.insertInto("app.plans").values(this.planColumns(body)).returningAll().executeTakeFirstOrThrow();
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "plan.created", entityType: "plan", entityId: row.id, data: { code: row.code }, requestId });
      return row;
    });
  }

  @Patch("plans/:code")
  async updatePlan(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("code", { schema: planCode }) code: string,
    @Body({ schema: adminPlanUpdateSchema }) body: Partial<AdminPlanRequest>,
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const current = await trx.selectFrom("app.plans").selectAll().where("code", "=", code).forUpdate().executeTakeFirst();
      if (!current) throw new ApiException("PLAN_NOT_FOUND");
      const merged = this.planColumns({
        ...this.planRequest(current),
        ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)),
        code,
      } as AdminPlanRequest);
      // Les licences déjà vendues ont COPIÉ les règles : elles ne changent pas.
      const row = await trx.updateTable("app.plans").set(merged).where("code", "=", code).returningAll().executeTakeFirstOrThrow();
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "plan.updated", entityType: "plan", entityId: row.id, data: { fields: Object.keys(body) }, requestId });
      return row;
    });
  }

  /** Nouveau prix : l'ancien prix de la même devise est clos, l'historique est conservé. */
  @Post("plans/:code/prices")
  async setPrice(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("code", { schema: planCode }) code: string,
    @Body({ schema: adminPriceSchema }) body: z.infer<typeof adminPriceSchema>,
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const plan = await trx.selectFrom("app.plans").select(["id", "is_free"]).where("code", "=", code).executeTakeFirst();
      if (!plan) throw new ApiException("PLAN_NOT_FOUND");
      if (plan.is_free) throw new ApiException("VALIDATION_FAILED", [{ path: "code", message: "la formule gratuite n'a pas de prix" }]);
      const now = new Date();
      await trx
        .updateTable("app.plan_prices")
        .set({ valid_to: now })
        .where("plan_id", "=", plan.id)
        .where("currency", "=", body.currency)
        .where("valid_to", "is", null)
        .execute();
      const row = await trx
        .insertInto("app.plan_prices")
        .values({ plan_id: plan.id, currency: body.currency, amount: body.amount, valid_from: now })
        .returning(["id", "currency", sql<string>`amount::text`.as("amount"), "valid_from"])
        .executeTakeFirstOrThrow();
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "plan.price_set", entityType: "plan", entityId: plan.id, data: body, requestId });
      return row;
    });
  }

  // -------------------------------- Catalogue -------------------------------

  @Patch("templates/:slug")
  async updateTemplate(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("slug", { schema: slug }) templateSlug: string,
    @Body({ schema: adminTemplateUpdateSchema }) body: z.infer<typeof adminTemplateUpdateSchema>,
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const template = await trx.selectFrom("app.templates").select("id").where("slug", "=", templateSlug).executeTakeFirst();
      if (!template) throw new ApiException("TEMPLATE_NOT_FOUND");
      const set = {
        ...(body.status ? { status: body.status } : {}),
        ...(body.translations ? { translations: JSON.stringify(body.translations) } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      };
      if (Object.keys(set).length) await trx.updateTable("app.templates").set(set).where("id", "=", template.id).execute();
      if (body.accessTags) {
        await trx.deleteFrom("app.template_access_tags").where("template_id", "=", template.id).execute();
        if (body.accessTags.length) {
          await trx
            .insertInto("app.template_access_tags")
            .values([...new Set(body.accessTags)].map((tag) => ({ template_id: template.id, tag })))
            .execute();
        }
      }
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "template.updated", entityType: "template", entityId: template.id, data: { fields: Object.keys(body) }, requestId });
      return { slug: templateSlug, ...body };
    });
  }

  // -------------------------------- Licences --------------------------------

  /** Licence offerte (geste commercial, §11.9) : règles copiées de la formule, journalisée. */
  @Post("licenses")
  async grant(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Body({ schema: adminGrantLicenseSchema }) body: z.infer<typeof adminGrantLicenseSchema>,
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const plan = await trx.selectFrom("app.plans").selectAll().where("code", "=", body.planCode).executeTakeFirst();
      if (!plan) throw new ApiException("PLAN_NOT_FOUND");
      if (plan.is_free) throw new ApiException("VALIDATION_FAILED", [{ path: "planCode", message: "la licence gratuite est attribuée automatiquement" }]);
      const startsNow = plan.start_policy !== "on_first_publication";
      const now = new Date();
      const row = await trx
        .insertInto("app.licenses")
        .values({
          user_id: body.userId,
          plan_id: plan.id,
          source: "admin_grant",
          status: "active",
          starts_at: startsNow ? now : null,
          ends_at: startsNow && plan.duration_days ? new Date(now.getTime() + plan.duration_days * 86_400_000) : null,
          activated_at: now,
          duration_days: plan.duration_days,
          start_policy: plan.start_policy,
          publications_max: plan.publications_max,
          recipients_max: plan.recipients_max,
          ai_generations_max: plan.ai_generations_max,
          template_access_mode: plan.template_access_mode,
          template_access_tag: plan.template_access_tag,
          edit_policy: plan.edit_policy,
          edit_days: plan.edit_days,
          max_publications_per_day: plan.max_publications_per_day,
        })
        .returning(["id", "status", "starts_at", "ends_at"])
        .executeTakeFirstOrThrow();
      await audit(trx, {
        actorType: "admin",
        actorId: admin.id,
        action: "license.granted",
        entityType: "license",
        entityId: row.id,
        data: { userId: body.userId, plan: body.planCode, reason: body.reason },
        requestId,
      });
      return { id: row.id, status: row.status, startsAt: toIso(row.starts_at), endsAt: toIso(row.ends_at) };
    });
  }

  // --------------------------------- Outils ---------------------------------

  private async suspendIn(trx: Tx, adminId: string, experienceId: string, reason: string, requestId: string | null) {
    const updated = await trx
      .updateTable("app.experiences")
      .set({ status: "suspended", suspension_reason: reason, status_changed_at: new Date() })
      .where("id", "=", experienceId)
      .where("status", "in", ["published", "disabled"])
      .executeTakeFirst();
    if (!updated.numUpdatedRows) throw new ApiException("EXPERIENCE_STATUS_CONFLICT");
    await audit(trx, { actorType: "admin", actorId: adminId, action: "experience.suspended", entityType: "experience", entityId: experienceId, requestId });
  }

  private planColumns(p: AdminPlanRequest) {
    return {
      code: p.code,
      name: p.name,
      description: p.description ?? null,
      translations: JSON.stringify(p.translations ?? {}),
      is_free: p.isFree,
      is_active: p.isActive,
      is_public: p.isPublic,
      position: p.position,
      duration_days: p.durationDays,
      start_policy: p.startPolicy,
      publications_max: p.publicationsMax,
      recipients_max: p.recipientsMax,
      ai_generations_max: p.aiGenerationsMax,
      template_access_mode: p.templateAccessTag ? ("tagged" as const) : ("all" as const),
      template_access_tag: p.templateAccessTag,
      edit_policy: p.editPolicy,
      edit_days: p.editPolicy === "days" ? p.editDays : null,
      max_publications_per_day: p.maxPublicationsPerDay,
    };
  }

  private planRequest(p: {
    code: string;
    name: string;
    description: string | null;
    translations: Record<string, unknown>;
    is_free: boolean;
    is_active: boolean;
    is_public: boolean;
    position: number;
    duration_days: number | null;
    start_policy: AdminPlanRequest["startPolicy"];
    publications_max: number | null;
    recipients_max: number | null;
    ai_generations_max: number;
    template_access_tag: string | null;
    edit_policy: AdminPlanRequest["editPolicy"];
    edit_days: number | null;
    max_publications_per_day: number;
  }): AdminPlanRequest {
    return {
      code: p.code,
      name: p.name,
      description: p.description,
      translations: p.translations as AdminPlanRequest["translations"],
      isFree: p.is_free,
      isActive: p.is_active,
      isPublic: p.is_public,
      position: p.position,
      durationDays: p.duration_days,
      startPolicy: p.start_policy,
      publicationsMax: p.publications_max,
      recipientsMax: p.recipients_max,
      aiGenerationsMax: p.ai_generations_max,
      templateAccessTag: p.template_access_tag,
      editPolicy: p.edit_policy,
      editDays: p.edit_days,
      maxPublicationsPerDay: p.max_publications_per_day,
    };
  }
}

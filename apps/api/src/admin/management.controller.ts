import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  type AdminSuspendedExperienceRow,
  type AdminTemplateRow,
  type AdminUserDetail,
  type AdminUserRow,
  adminRevokeLicenseSchema,
  adminSuspendUserSchema,
  type AdminUsersQuery,
  adminUsersQuerySchema,
} from "@zaweli/shared-types";
import { sql } from "kysely";
import { z } from "zod";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { Roles, RolesGuard } from "../auth/roles.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction, toIso } from "../database/transaction.js";
import { RequestId } from "../i18n/locale.js";
import { AuthAdmin } from "../me/account.service.js";

const id = z.uuid();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Écrans de gestion (cahier des charges §11.9) : comptes, licences,
 * modèles, modération. Rôle `admin` lu en base ; chaque geste est
 * journalisé. Le contenu des expériences ne s'édite jamais d'ici.
 */
@Controller("admin")
@UseGuards(RolesGuard)
@Roles("admin")
export class ManagementController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly authAdmin: AuthAdmin,
  ) {}

  // -------------------------------- Comptes ---------------------------------

  @Get("users")
  async users(@Query({ schema: adminUsersQuerySchema }) q: AdminUsersQuery): Promise<AdminUserRow[]> {
    let query = this.userRows();
    if (q.status === "suspended") query = query.where("p.suspended_at", "is not", null);
    const term = q.q?.trim();
    if (term) {
      query = UUID.test(term)
        ? query.where("u.id", "=", term)
        : query.where((eb) => eb.or([eb("u.email", "ilike", `%${escapeLike(term)}%`), eb("p.display_name", "ilike", `%${escapeLike(term)}%`), eb("p.referral_code", "=", term.toUpperCase())]));
    }
    const rows = await query.orderBy("p.created_at", "desc").limit(q.limit).execute();
    return rows.map((r) => this.toRow(r));
  }

  @Get("users/:id")
  async user(@Param("id", { schema: id }) userId: string): Promise<AdminUserDetail> {
    const row = await this.userRows()
      .select(["p.locale", "p.suspension_reason", "p.deleted_at", "p.referral_code"])
      .where("u.id", "=", userId)
      .executeTakeFirst();
    if (!row) throw new ApiException("USER_NOT_FOUND");
    const [licenses, orders, experiences] = await Promise.all([
      this.db
        .selectFrom("app.licenses as l")
        .innerJoin("app.plans as pl", "pl.id", "l.plan_id")
        .select(["l.id", "pl.name as plan", "l.source", "l.status", "l.starts_at", "l.ends_at", "l.publications_used", "l.publications_max", "l.ai_generations_used", "l.ai_generations_max"])
        .where("l.user_id", "=", userId)
        .orderBy("l.created_at", "desc")
        .execute(),
      this.db
        .selectFrom("app.orders as o")
        .innerJoin("app.plans as pl", "pl.id", "o.plan_id")
        .select(["o.id", "pl.name as plan", "o.status", "o.list_amount", "o.amount", "o.currency", "o.created_at", "o.paid_at"])
        .where("o.user_id", "=", userId)
        .orderBy("o.created_at", "desc")
        .limit(50)
        .execute(),
      this.db
        .selectFrom("app.experiences as e")
        .innerJoin("app.templates as t", "t.id", "e.template_id")
        .innerJoin("app.recipients as r", "r.id", "e.recipient_id")
        .select(["e.id", "e.title", "r.display_name as recipient", "t.name as template", "e.status", "e.slug", "e.updated_at"])
        .where("e.owner_id", "=", userId)
        .where("e.status", "!=", "deleted")
        .orderBy("e.updated_at", "desc")
        .limit(50)
        .execute(),
    ]);
    return {
      ...this.toRow(row),
      locale: row.locale,
      suspensionReason: row.suspension_reason,
      deletedAt: toIso(row.deleted_at),
      referralCode: row.referral_code,
      licenses: licenses.map((l) => ({
        id: l.id,
        plan: l.plan,
        source: l.source,
        status: l.status,
        startsAt: toIso(l.starts_at),
        endsAt: toIso(l.ends_at),
        publications: { used: l.publications_used, max: l.publications_max },
        ai: { used: l.ai_generations_used, max: l.ai_generations_max },
      })),
      orders: orders.map((o) => ({ id: o.id, plan: o.plan, status: o.status, amount: o.list_amount ?? o.amount, currency: o.currency, createdAt: toIso(o.created_at)!, paidAt: toIso(o.paid_at) })),
      experienceList: experiences.map((e) => ({ id: e.id, title: e.title, recipient: e.recipient, template: e.template, status: e.status, slug: e.slug, updatedAt: toIso(e.updated_at)! })),
    };
  }

  /** Suspension d'un compte : jetons refusés par l'API, connexion bloquée par Supabase Auth. */
  @Post("users/:id/suspend")
  @HttpCode(200)
  async suspendUser(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) userId: string,
    @Body({ schema: adminSuspendUserSchema }) body: { reason: string },
  ): Promise<AdminUserDetail> {
    if (userId === admin.id) throw new ApiException("VALIDATION_FAILED", [{ path: "id", message: "impossible de suspendre son propre compte" }]);
    await inTransaction(this.db, "admin", admin.id, async (trx) => {
      const updated = await trx
        .updateTable("app.profiles")
        .set({ suspended_at: new Date(), suspension_reason: body.reason })
        .where("id", "=", userId)
        .where("suspended_at", "is", null)
        .executeTakeFirst();
      if (!updated.numUpdatedRows) {
        const exists = await trx.selectFrom("app.profiles").select("id").where("id", "=", userId).executeTakeFirst();
        if (!exists) throw new ApiException("USER_NOT_FOUND");
        return;
      }
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "user.suspended", entityType: "user", entityId: userId, data: { reason: body.reason }, requestId });
    });
    if (this.authAdmin.available) await this.authAdmin.setBanned(userId, true);
    return this.user(userId);
  }

  @Post("users/:id/unsuspend")
  @HttpCode(200)
  async unsuspendUser(@CurrentUser() admin: AuthenticatedUser, @RequestId() requestId: string | null, @Param("id", { schema: id }) userId: string): Promise<AdminUserDetail> {
    await inTransaction(this.db, "admin", admin.id, async (trx) => {
      const updated = await trx
        .updateTable("app.profiles")
        .set({ suspended_at: null, suspension_reason: null })
        .where("id", "=", userId)
        .where("suspended_at", "is not", null)
        .executeTakeFirst();
      if (updated.numUpdatedRows) await audit(trx, { actorType: "admin", actorId: admin.id, action: "user.unsuspended", entityType: "user", entityId: userId, requestId });
    });
    if (this.authAdmin.available) await this.authAdmin.setBanned(userId, false);
    return this.user(userId);
  }

  // -------------------------------- Licences --------------------------------

  /** Retrait d'une licence (erreur, fraude) : ses expériences publiées restent servies (§8.5). */
  @Post("licenses/:id/revoke")
  @HttpCode(200)
  async revokeLicense(
    @CurrentUser() admin: AuthenticatedUser,
    @RequestId() requestId: string | null,
    @Param("id", { schema: id }) licenseId: string,
    @Body({ schema: adminRevokeLicenseSchema }) body: { reason: string },
  ) {
    return inTransaction(this.db, "admin", admin.id, async (trx) => {
      const row = await trx
        .updateTable("app.licenses")
        .set({ status: "revoked" })
        .where("id", "=", licenseId)
        .where("status", "in", ["active", "pending"])
        .returning(["id", "user_id", "status"])
        .executeTakeFirst();
      if (!row) throw new ApiException("LICENSE_NOT_ACTIVE");
      await audit(trx, { actorType: "admin", actorId: admin.id, action: "license.revoked", entityType: "license", entityId: licenseId, data: { userId: row.user_id, reason: body.reason }, requestId });
      return { id: row.id, status: row.status };
    });
  }

  // -------------------------------- Modèles ---------------------------------

  @Get("templates")
  async templates(): Promise<AdminTemplateRow[]> {
    const rows = await this.db
      .selectFrom("app.templates as t")
      .leftJoin("app.template_categories as c", "c.id", "t.category_id")
      .leftJoin("app.template_versions as cv", "cv.id", "t.current_version_id")
      .select([
        "t.id",
        "t.slug",
        "t.name",
        "t.status",
        "t.position",
        "c.name as category",
        "cv.version as currentVersion",
        sql<number>`(select count(*)::int from app.experiences e where e.template_id = t.id and e.status <> 'deleted')`.as("experiences"),
        sql<number>`(select count(*)::int from app.experiences e where e.template_id = t.id and e.status = 'published')`.as("published"),
      ])
      .orderBy("t.position")
      .orderBy("t.name")
      .execute();
    const [versions, tags] = await Promise.all([
      this.db.selectFrom("app.template_versions").select(["template_id", "version", "status", "published_at"]).orderBy("published_at", "desc").execute(),
      this.db.selectFrom("app.template_access_tags").select(["template_id", "tag"]).execute(),
    ]);
    return rows.map((t) => ({
      slug: t.slug,
      name: t.name,
      status: t.status as AdminTemplateRow["status"],
      position: t.position,
      category: t.category,
      currentVersion: t.currentVersion,
      versions: versions.filter((v) => v.template_id === t.id).map((v) => ({ version: v.version, status: v.status, publishedAt: toIso(v.published_at) })),
      accessTags: tags.filter((x) => x.template_id === t.id).map((x) => x.tag),
      experiences: t.experiences,
      published: t.published,
    }));
  }

  // ------------------------------- Modération -------------------------------

  /** Expériences retirées par la modération, pour les rétablir si besoin. */
  @Get("experiences/suspended")
  async suspended(): Promise<AdminSuspendedExperienceRow[]> {
    const rows = await this.db
      .selectFrom("app.experiences as e")
      .innerJoin("app.templates as t", "t.id", "e.template_id")
      .innerJoin("auth.users as u", "u.id", "e.owner_id")
      .select(["e.id", "e.slug", "e.title", "t.name as template", "u.email", "e.suspension_reason", "e.status_changed_at"])
      .where("e.status", "=", "suspended")
      .orderBy("e.status_changed_at", "desc")
      .limit(200)
      .execute();
    return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, template: r.template, ownerEmail: r.email, reason: r.suspension_reason, suspendedAt: toIso(r.status_changed_at)! }));
  }

  // --------------------------------- Outils ---------------------------------

  private userRows() {
    return this.db
      .selectFrom("app.profiles as p")
      .innerJoin("auth.users as u", "u.id", "p.id")
      .select([
        "u.id",
        "u.email",
        "p.display_name",
        "p.country_code",
        "p.created_at",
        "p.suspended_at",
        sql<string[]>`coalesce((select array_agg(r.role::text) from app.user_roles r where r.user_id = p.id), '{}')`.as("roles"),
        sql<number>`(select count(*)::int from app.experiences e where e.owner_id = p.id and e.status <> 'deleted')`.as("experiences"),
        sql<number>`(select count(*)::int from app.orders o where o.user_id = p.id and o.status = 'paid')`.as("paid_orders"),
        sql<number>`(select count(*)::int from app.licenses l where l.user_id = p.id and l.status = 'active')`.as("active_licenses"),
      ]);
  }

  private toRow(r: {
    id: string;
    email: string | null;
    display_name: string | null;
    country_code: string | null;
    created_at: Date;
    suspended_at: Date | null;
    roles: string[];
    experiences: number;
    paid_orders: number;
    active_licenses: number;
  }): AdminUserRow {
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      countryCode: r.country_code,
      createdAt: toIso(r.created_at)!,
      suspendedAt: toIso(r.suspended_at),
      roles: r.roles ?? [],
      experiences: r.experiences,
      paidOrders: r.paid_orders,
      activeLicenses: r.active_licenses,
    };
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

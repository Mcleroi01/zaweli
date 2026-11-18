import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateExperienceRequest,
  CreateGiftRequest,
  ExperienceDetailResponse,
  ExperienceStatus,
  ExperienceSummaryResponse,
  GiftResponse,
  Locale,
  PublishExperienceRequest,
  PublishResponse,
  UpdateExperienceRequest,
  UpdateGiftRequest,
} from "@zaweli/shared-types";
import {
  buildPublicPayload,
  compileContentSchema,
  type GiftListField,
  giftDataSchemas,
  giftProtectedSchemas,
  type PublicGift,
  type TemplateManifest,
} from "@zaweli/template-engine/schema";
import { sql } from "kysely";
import type { z } from "zod";
import { ApiException } from "../common/api-exception.js";
import { ENV, type Env } from "../config/env.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction, readSetting, type Tx, toIso } from "../database/transaction.js";
import { LicensingService } from "../licensing/licensing.service.js";

type Ctx = { userId: string; requestId: string | null };

const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
/** Lien public non devinable (§7.6) : 12 caractères parmi 57, sans prénom dans l'URL. */
const newSlug = () => Array.from(randomBytes(12), (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");

const issuesOf = (error: z.ZodError) =>
  error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));

type ExperienceRow = {
  id: string;
  owner_id: string;
  template_id: string;
  template_version_id: string;
  recipient_id: string;
  title: string | null;
  status: ExperienceStatus;
  locale: Locale;
  content: { fields?: Record<string, unknown> };
  disabled_sections: string[];
  content_revision: number;
  slug: string | null;
  current_snapshot_id: string | null;
  first_published_at: Date | null;
  last_published_at: Date | null;
  updated_at: Date;
};

/**
 * Cycle de vie d'une expérience (architecture §6) : brouillon, contenu validé
 * contre le manifeste de SA version figée, cadeaux typés, publication
 * transactionnelle, republication d'une révision, désactivation, suppression.
 */
@Injectable()
export class ExperiencesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly licensing: LicensingService,
  ) {}

  // -------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------

  async list(userId: string, status?: ExperienceStatus): Promise<ExperienceSummaryResponse[]> {
    let query = this.summaryQuery(this.db).where("e.owner_id", "=", userId);
    query = status ? query.where("e.status", "=", status) : query.where("e.status", "<>", "deleted");
    const rows = await query.orderBy("e.updated_at", "desc").execute();
    return rows.map((r) => this.toSummary(r));
  }

  async detail(userId: string, id: string, db: Db | Tx = this.db): Promise<ExperienceDetailResponse> {
    const row = await this.summaryQuery(db)
      .select(["e.content", "e.disabled_sections", "e.current_snapshot_id", "v.manifest"])
      .where("e.id", "=", id)
      .where("e.owner_id", "=", userId)
      .where("e.status", "<>", "deleted")
      .executeTakeFirst();
    if (!row) throw new ApiException("EXPERIENCE_NOT_FOUND");
    const manifest = row.manifest as unknown as TemplateManifest;
    const gifts = await this.gifts(db, id);
    const content = { fields: row.content.fields ?? {}, disabledSections: row.disabled_sections };
    const parsed = compileContentSchema(manifest, "publish").safeParse(content);
    const publishIssues = parsed.success ? [] : issuesOf(parsed.error);
    publishIssues.push(...this.giftIssues(manifest, content.fields, gifts));
    const snapshot = row.current_snapshot_id
      ? await db.selectFrom("app.experience_snapshots").select("revision").where("id", "=", row.current_snapshot_id).executeTakeFirst()
      : undefined;
    return {
      ...this.toSummary(row),
      content,
      gifts: gifts.map((g) => this.toGift(g)),
      publishIssues,
      hasUnpublishedChanges: row.status !== "draft" && snapshot?.revision !== row.content_revision,
      canEdit: await this.licensing.canEdit(db, row),
    };
  }

  async eligibility(userId: string, id: string) {
    const e = await this.owned(this.db, userId, id);
    return this.licensing.eligibility(userId, { templateId: e.template_id, recipientId: e.recipient_id });
  }

  // -------------------------------------------------------------------
  // Brouillons
  // -------------------------------------------------------------------

  async create(ctx: Ctx, body: CreateExperienceRequest, requestLocale: Locale): Promise<ExperienceDetailResponse> {
    const id = await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const template = await trx
        .selectFrom("app.templates as t")
        .innerJoin("app.template_versions as v", "v.id", "t.current_version_id")
        .select(["t.id", "t.status", "v.id as version_id", "v.status as version_status"])
        .where("t.slug", "=", body.templateSlug)
        .executeTakeFirst();
      if (!template) throw new ApiException("TEMPLATE_NOT_FOUND");
      if (template.status !== "published" || template.version_status !== "published") throw new ApiException("TEMPLATE_NOT_AVAILABLE");

      await this.ownedRecipient(trx, ctx.userId, body.recipientId);

      // Garde-fou C18 : nombre de brouillons actifs (sérialisé par compte).
      await sql`select pg_advisory_xact_lock(hashtext(${`drafts:${ctx.userId}`}))`.execute(trx);
      const max = Number(await readSetting(trx, "drafts.max_active", 5));
      const { drafts } = await trx
        .selectFrom("app.experiences")
        .select((eb) => eb.fn.countAll<number>().as("drafts"))
        .where("owner_id", "=", ctx.userId)
        .where("status", "=", "draft")
        .executeTakeFirstOrThrow();
      if (Number(drafts) >= max) throw new ApiException("DRAFT_LIMIT_REACHED", { max });

      const profile = await trx.selectFrom("app.profiles").select("locale").where("id", "=", ctx.userId).executeTakeFirst();
      const row = await trx
        .insertInto("app.experiences")
        .values({
          owner_id: ctx.userId,
          template_id: template.id,
          template_version_id: template.version_id,
          recipient_id: body.recipientId,
          title: body.title ?? null,
          locale: body.locale ?? profile?.locale ?? requestLocale,
          content: JSON.stringify({ fields: {} }),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await audit(trx, {
        actorType: "user",
        actorId: ctx.userId,
        action: "experience.created",
        entityType: "experience",
        entityId: row.id,
        data: { template: body.templateSlug },
        requestId: ctx.requestId,
      });
      return row.id;
    });
    return this.detail(ctx.userId, id);
  }

  async update(ctx: Ctx, id: string, body: UpdateExperienceRequest): Promise<ExperienceDetailResponse> {
    await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const e = await this.lockEditable(trx, ctx.userId, id, body.expectedRevision);
      const changes: Record<string, unknown> = {};

      if (body.title !== undefined) changes.title = body.title;
      if (body.locale) changes.locale = body.locale;
      if (body.recipientId && body.recipientId !== e.recipient_id) {
        // Après une publication, le destinataire est lié à la licence : on ne le change plus.
        if (e.first_published_at) throw new ApiException("EXPERIENCE_NOT_EDITABLE", { field: "recipientId" });
        await this.ownedRecipient(trx, ctx.userId, body.recipientId);
        changes.recipient_id = body.recipientId;
      }
      if (body.content) {
        const manifest = await this.manifest(trx, e.template_version_id);
        const parsed = compileContentSchema(manifest, "draft").safeParse(body.content);
        if (!parsed.success) throw new ApiException("EXPERIENCE_CONTENT_INVALID", issuesOf(parsed.error));
        const giftIds = new Set((await this.gifts(trx, id)).map((g) => g.id));
        const unknown = this.giftIdsIn(manifest, parsed.data.fields).filter((g) => !giftIds.has(g));
        if (unknown.length) throw new ApiException("GIFT_NOT_FOUND", { giftIds: unknown });
        changes.content = JSON.stringify({ fields: parsed.data.fields });
        changes.disabled_sections = parsed.data.disabledSections;
      }
      await trx
        .updateTable("app.experiences")
        .set({ ...changes, content_revision: e.content_revision + 1 })
        .where("id", "=", id)
        .execute();
    });
    return this.detail(ctx.userId, id);
  }

  /** Suppression logique : un brouillon, ou une expérience déjà désactivée (§6). */
  async remove(ctx: Ctx, id: string): Promise<void> {
    await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const e = await this.lock(trx, ctx.userId, id);
      if (e.status !== "draft" && e.status !== "disabled") throw new ApiException("EXPERIENCE_STATUS_CONFLICT", { status: e.status });
      await trx
        .updateTable("app.experiences")
        .set({ status: "deleted", deleted_at: new Date(), status_changed_at: new Date() })
        .where("id", "=", id)
        .execute();
      await audit(trx, { actorType: "user", actorId: ctx.userId, action: "experience.deleted", entityType: "experience", entityId: id, requestId: ctx.requestId });
    });
  }

  /** Désactiver (le lien affiche « plus disponible ») ou réactiver. La modération (suspended) reste prioritaire. */
  async setEnabled(ctx: Ctx, id: string, enabled: boolean): Promise<ExperienceDetailResponse> {
    await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const e = await this.lock(trx, ctx.userId, id);
      const from = enabled ? "disabled" : "published";
      if (e.status !== from) throw new ApiException("EXPERIENCE_STATUS_CONFLICT", { status: e.status });
      await trx
        .updateTable("app.experiences")
        .set({ status: enabled ? "published" : "disabled", status_changed_at: new Date() })
        .where("id", "=", id)
        .execute();
      await audit(trx, {
        actorType: "user",
        actorId: ctx.userId,
        action: enabled ? "experience.enabled" : "experience.disabled",
        entityType: "experience",
        entityId: id,
        requestId: ctx.requestId,
      });
    });
    return this.detail(ctx.userId, id);
  }

  // -------------------------------------------------------------------
  // Publication (§6.1 de l'architecture : une seule transaction)
  // -------------------------------------------------------------------

  async publish(ctx: Ctx, id: string, body: PublishExperienceRequest): Promise<PublishResponse> {
    return inTransaction(this.db, "user", ctx.userId, async (trx) => {
      // 1. Verrou sur l'expérience.
      const e = await this.lock(trx, ctx.userId, id);
      const republish = e.status === "published";
      if (!republish && e.status !== "draft") throw new ApiException("EXPERIENCE_STATUS_CONFLICT", { status: e.status });
      if (republish && !(await this.licensing.canEdit(trx, e))) throw new ApiException("EXPERIENCE_NOT_EDITABLE");

      // Rien n'a changé depuis la dernière publication : réponse idempotente (double clic).
      if (republish && e.current_snapshot_id) {
        const current = await trx.selectFrom("app.experience_snapshots").select("revision").where("id", "=", e.current_snapshot_id).executeTakeFirstOrThrow();
        if (current.revision === e.content_revision) return this.published(e.slug!, current.revision, null);
      }

      // 2. Contenu validé contre le manifeste de SA version.
      const manifest = await this.manifest(trx, e.template_version_id);
      const parsed = compileContentSchema(manifest, "publish").safeParse({ fields: e.content.fields ?? {}, disabledSections: e.disabled_sections });
      if (!parsed.success) throw new ApiException("EXPERIENCE_CONTENT_INVALID", issuesOf(parsed.error));
      const gifts = await this.gifts(trx, id);
      const giftIssues = this.giftIssues(manifest, parsed.data.fields, gifts);
      if (giftIssues.length) throw new ApiException("EXPERIENCE_CONTENT_INVALID", giftIssues);
      const photos = await this.publishedPhotos(trx, ctx.userId, manifest, parsed.data.fields);

      // 3 et 4. Licence choisie, puis consommation sous verrou (première publication seulement).
      let licenseId: string | null = null;
      if (!republish) {
        const pick = await this.licensing.pickLicense(trx, ctx.userId, { templateId: e.template_id, recipientId: e.recipient_id }, body);
        if (!pick.id) throw new ApiException(pick.reason ?? "NO_ELIGIBLE_LICENSE");
        licenseId = pick.id;
        await sql`select app.consume_publication(${ctx.userId}::uuid, ${licenseId}::uuid, ${id}::uuid)`.execute(trx);
      }

      // 5. Instantané : partie publique (navigateur du destinataire) et partie protégée.
      const salt = randomBytes(16).toString("hex");
      const publicGifts: PublicGift[] = gifts.map((g) => ({ id: g.id, type: g.gift_type, status: g.status, data: g.data }) as PublicGift);
      const payload = await buildPublicPayload(manifest, parsed.data, {
        resolvePhoto: (mediaId) => {
          const photo = photos.get(mediaId);
          if (!photo) throw new ApiException("MEDIA_NOT_READY", { mediaIds: [mediaId] });
          return photo;
        },
        gifts: publicGifts,
        salt,
        locale: e.locale,
      });
      const protectedGifts = Object.fromEntries(
        gifts.filter((g) => Object.keys(g.protected_data).length > 0).map((g) => [g.id, g.protected_data]),
      );
      const snapshot = await trx
        .insertInto("app.experience_snapshots")
        .values({
          experience_id: id,
          revision: e.content_revision,
          template_version_id: e.template_version_id,
          public_payload: JSON.stringify(payload),
          protected_payload: JSON.stringify({ gifts: protectedGifts }),
          created_by: ctx.userId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const slug = e.slug ?? newSlug();
      const now = new Date();
      await trx
        .updateTable("app.experiences")
        .set({
          status: "published",
          slug,
          current_snapshot_id: snapshot.id,
          last_published_at: now,
          ...(republish ? {} : { first_published_at: now, status_changed_at: now }),
        })
        .where("id", "=", id)
        .execute();

      // 6. Audit (après le commit viendront : copie des médias, e-mail, cache).
      await audit(trx, {
        actorType: "user",
        actorId: ctx.userId,
        action: republish ? "experience.republished" : "experience.published",
        entityType: "experience",
        entityId: id,
        data: { revision: e.content_revision, licenseId },
        requestId: ctx.requestId,
      });
      return this.published(slug, e.content_revision, licenseId);
    });
  }

  // -------------------------------------------------------------------
  // Cadeaux (§9) : données validées par type, statuts contrôlés en base
  // -------------------------------------------------------------------

  async addGift(ctx: Ctx, experienceId: string, body: CreateGiftRequest): Promise<GiftResponse> {
    return inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const e = await this.lockEditable(trx, ctx.userId, experienceId);
      const manifest = await this.manifest(trx, e.template_version_id);
      const lists = this.giftLists(manifest).filter(([, def]) => def.types.includes(body.type));
      if (lists.length === 0) throw new ApiException("GIFT_TYPE_NOT_ACCEPTED", { type: body.type });
      const { data, protectedData } = this.validateGift(body.type, body.data, body.protectedData);
      const existing = await this.gifts(trx, experienceId);
      const capacity = this.giftLists(manifest).reduce((n, [, def]) => n + def.max, 0);
      if (existing.length >= capacity) throw new ApiException("GIFT_LIMIT_REACHED", { max: capacity });

      const money = body.type === "MONEY" ? (data as { amount: number; currency: string }) : null;
      const row = await trx
        .insertInto("app.gifts")
        .values({
          owner_id: ctx.userId,
          experience_id: experienceId,
          position: existing.reduce((max, g) => Math.max(max, g.position + 1), 0),
          gift_type: body.type,
          status: "ANNOUNCED",
          data: JSON.stringify(data),
          protected_data: JSON.stringify(protectedData ?? {}),
          amount: money ? money.amount.toFixed(2) : null,
          currency: money ? money.currency : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Le cadeau rejoint la première liste qui l'accepte et qui a encore de la place.
      const fields: Record<string, unknown> = { ...e.content.fields };
      const target = lists.find(([fieldId, def]) => ((fields[fieldId] as string[] | undefined) ?? []).length < def.max);
      if (target) fields[target[0]] = [...((fields[target[0]] as string[] | undefined) ?? []), row.id];
      await this.bumpContent(trx, e, fields);
      return this.toGift(row);
    });
  }

  async updateGift(ctx: Ctx, experienceId: string, giftId: string, body: UpdateGiftRequest): Promise<GiftResponse> {
    return inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const e = await this.lockEditable(trx, ctx.userId, experienceId);
      const gift = (await this.gifts(trx, experienceId)).find((g) => g.id === giftId);
      if (!gift) throw new ApiException("GIFT_NOT_FOUND");
      const { data, protectedData } = this.validateGift(
        gift.gift_type,
        body.data ?? gift.data,
        body.protectedData === null ? undefined : (body.protectedData ?? (Object.keys(gift.protected_data).length ? gift.protected_data : undefined)),
      );
      const money = gift.gift_type === "MONEY" ? (data as { amount: number; currency: string }) : null;
      const row = await trx
        .updateTable("app.gifts")
        .set({
          data: JSON.stringify(data),
          protected_data: JSON.stringify(protectedData ?? {}),
          ...(money ? { amount: money.amount.toFixed(2), currency: money.currency } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
        })
        .where("id", "=", giftId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.bumpContent(trx, e, e.content.fields ?? {});
      return this.toGift(row);
    });
  }

  async removeGift(ctx: Ctx, experienceId: string, giftId: string): Promise<void> {
    await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const e = await this.lockEditable(trx, ctx.userId, experienceId);
      const deleted = await trx.deleteFrom("app.gifts").where("id", "=", giftId).where("experience_id", "=", experienceId).executeTakeFirst();
      if (!deleted.numDeletedRows) throw new ApiException("GIFT_NOT_FOUND");
      const manifest = await this.manifest(trx, e.template_version_id);
      const fields: Record<string, unknown> = { ...e.content.fields };
      for (const [fieldId] of this.giftLists(manifest)) {
        const ids = fields[fieldId] as string[] | undefined;
        if (ids) fields[fieldId] = ids.filter((x) => x !== giftId);
      }
      await this.bumpContent(trx, e, fields);
    });
  }

  /** Changement de statut déclaré par l'expéditeur (ex. HANDED_OVER) : la base vérifie la transition et l'acteur. */
  async setGiftStatus(ctx: Ctx, experienceId: string, giftId: string, status: string): Promise<GiftResponse> {
    return inTransaction(this.db, "user", ctx.userId, async (trx) => {
      await this.lock(trx, ctx.userId, experienceId);
      const row = await trx
        .updateTable("app.gifts")
        .set({ status })
        .where("id", "=", giftId)
        .where("experience_id", "=", experienceId)
        .where("owner_id", "=", ctx.userId)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new ApiException("GIFT_NOT_FOUND");
      await audit(trx, {
        actorType: "user",
        actorId: ctx.userId,
        action: "gift.status_changed",
        entityType: "gift",
        entityId: giftId,
        data: { status },
        requestId: ctx.requestId,
      });
      return this.toGift(row);
    });
  }

  // -------------------------------------------------------------------
  // Outils
  // -------------------------------------------------------------------

  private published(slug: string, revision: number, licenseId: string | null): PublishResponse {
    return { slug, url: `${this.env.PUBLIC_WEB_URL.replace(/\/+$/, "")}/g/${slug}`, revision, licenseId };
  }

  private summaryQuery(db: Db | Tx) {
    return db
      .selectFrom("app.experiences as e")
      .innerJoin("app.templates as t", "t.id", "e.template_id")
      .innerJoin("app.template_versions as v", "v.id", "e.template_version_id")
      .innerJoin("app.recipients as r", "r.id", "e.recipient_id")
      .select([
        "e.id",
        "e.title",
        "e.status",
        "e.locale",
        "e.slug",
        "e.content_revision",
        "e.first_published_at",
        "e.last_published_at",
        "e.updated_at",
        "t.slug as template_slug",
        "t.name as template_name",
        "v.version",
        "r.id as recipient_id",
        "r.display_name as recipient_name",
      ]);
  }

  private toSummary(r: {
    id: string;
    title: string | null;
    status: ExperienceStatus;
    locale: Locale;
    slug: string | null;
    content_revision: number;
    first_published_at: Date | null;
    last_published_at: Date | null;
    updated_at: Date;
    template_slug: string;
    template_name: string;
    version: string;
    recipient_id: string;
    recipient_name: string;
  }): ExperienceSummaryResponse {
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      locale: r.locale,
      template: { slug: r.template_slug, name: r.template_name, version: r.version },
      recipient: { id: r.recipient_id, displayName: r.recipient_name },
      slug: r.slug,
      contentRevision: r.content_revision,
      firstPublishedAt: toIso(r.first_published_at),
      lastPublishedAt: toIso(r.last_published_at),
      updatedAt: toIso(r.updated_at)!,
    };
  }

  private selectExperience(db: Db | Tx) {
    return db
      .selectFrom("app.experiences")
      .select([
        "id",
        "owner_id",
        "template_id",
        "template_version_id",
        "recipient_id",
        "title",
        "status",
        "locale",
        "content",
        "disabled_sections",
        "content_revision",
        "slug",
        "current_snapshot_id",
        "first_published_at",
        "last_published_at",
        "updated_at",
      ]);
  }

  private async owned(db: Db | Tx, userId: string, id: string): Promise<ExperienceRow> {
    const row = await this.selectExperience(db)
      .where("id", "=", id)
      .where("owner_id", "=", userId)
      .where("status", "<>", "deleted")
      .executeTakeFirst();
    if (!row) throw new ApiException("EXPERIENCE_NOT_FOUND");
    return row as ExperienceRow;
  }

  /** Verrou de ligne : deux écritures simultanées sur la même expérience sont sérialisées. */
  private async lock(trx: Tx, userId: string, id: string): Promise<ExperienceRow> {
    const row = await this.selectExperience(trx)
      .where("id", "=", id)
      .where("owner_id", "=", userId)
      .where("status", "<>", "deleted")
      .forUpdate()
      .executeTakeFirst();
    if (!row) throw new ApiException("EXPERIENCE_NOT_FOUND");
    return row as ExperienceRow;
  }

  private async lockEditable(trx: Tx, userId: string, id: string, expectedRevision?: number): Promise<ExperienceRow> {
    const e = await this.lock(trx, userId, id);
    if (expectedRevision !== undefined && expectedRevision !== e.content_revision) {
      throw new ApiException("EXPERIENCE_REVISION_CONFLICT", { currentRevision: e.content_revision });
    }
    if (!(await this.licensing.canEdit(trx, e))) throw new ApiException("EXPERIENCE_NOT_EDITABLE");
    return e;
  }

  private async bumpContent(trx: Tx, e: ExperienceRow, fields: Record<string, unknown>) {
    await trx
      .updateTable("app.experiences")
      .set({ content: JSON.stringify({ fields }), content_revision: e.content_revision + 1 })
      .where("id", "=", e.id)
      .execute();
  }

  private async ownedRecipient(db: Db | Tx, userId: string, recipientId: string) {
    const row = await db
      .selectFrom("app.recipients")
      .select("id")
      .where("id", "=", recipientId)
      .where("owner_id", "=", userId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!row) throw new ApiException("RECIPIENT_NOT_FOUND");
  }

  private async manifest(db: Db | Tx, versionId: string): Promise<TemplateManifest> {
    const row = await db.selectFrom("app.template_versions").select("manifest").where("id", "=", versionId).executeTakeFirstOrThrow();
    return row.manifest as unknown as TemplateManifest;
  }

  private gifts(db: Db | Tx, experienceId: string) {
    return db
      .selectFrom("app.gifts")
      .select(["id", "gift_type", "status", "position", "data", "protected_data"])
      .where("experience_id", "=", experienceId)
      .orderBy("position")
      .execute();
  }

  private toGift(g: { id: string; gift_type: string; status: string; position: number; data: Record<string, unknown>; protected_data: Record<string, unknown> }): GiftResponse {
    return {
      id: g.id,
      type: g.gift_type,
      status: g.status,
      position: g.position,
      data: g.data,
      hasProtectedData: Object.keys(g.protected_data ?? {}).length > 0,
    };
  }

  private giftLists(manifest: TemplateManifest): Array<[string, GiftListField]> {
    return Object.entries(manifest.fields).filter((entry): entry is [string, GiftListField] => entry[1].kind === "giftList");
  }

  private giftIdsIn(manifest: TemplateManifest, fields: Record<string, unknown>): string[] {
    return this.giftLists(manifest).flatMap(([id]) => (fields[id] as string[] | undefined) ?? []);
  }

  /** Chaque cadeau référencé existe et son type est accepté par la liste qui le contient. */
  private giftIssues(manifest: TemplateManifest, fields: Record<string, unknown>, gifts: Array<{ id: string; gift_type: string }>) {
    const byId = new Map(gifts.map((g) => [g.id, g]));
    const issues: Array<{ path: string; message: string }> = [];
    for (const [fieldId, def] of this.giftLists(manifest)) {
      for (const giftId of (fields[fieldId] as string[] | undefined) ?? []) {
        const gift = byId.get(giftId);
        if (!gift) issues.push({ path: `fields.${fieldId}`, message: `cadeau introuvable : ${giftId}` });
        else if (!(def.types as readonly string[]).includes(gift.gift_type)) issues.push({ path: `fields.${fieldId}`, message: `type non accepté : ${gift.gift_type}` });
      }
    }
    return issues;
  }

  private validateGift(type: string, data: unknown, protectedData: unknown) {
    const dataSchema = giftDataSchemas[type as keyof typeof giftDataSchemas];
    if (!dataSchema) throw new ApiException("GIFT_TYPE_NOT_ACCEPTED", { type });
    const parsed = dataSchema.safeParse(data);
    if (!parsed.success) throw new ApiException("VALIDATION_FAILED", issuesOf(parsed.error));
    const protectedSchema = (giftProtectedSchemas as Record<string, z.ZodType | undefined>)[type];
    if (protectedData === undefined) return { data: parsed.data, protectedData: undefined };
    if (!protectedSchema) throw new ApiException("VALIDATION_FAILED", [{ path: "protectedData", message: "non accepté pour ce type" }]);
    const parsedProtected = protectedSchema.safeParse(protectedData);
    if (!parsedProtected.success) throw new ApiException("VALIDATION_FAILED", issuesOf(parsedProtected.error));
    return { data: parsed.data, protectedData: parsedProtected.data as Record<string, unknown> };
  }

  /**
   * Photos référencées par le contenu : elles doivent appartenir à l'expéditeur
   * et avoir été traitées puis copiées vers le stockage publié (A11).
   */
  private async publishedPhotos(trx: Tx, userId: string, manifest: TemplateManifest, fields: Record<string, unknown>) {
    const ids = new Set<string>();
    for (const [fieldId, def] of Object.entries(manifest.fields)) {
      const value = fields[fieldId];
      if (value === undefined) continue;
      if (def.kind === "photo") ids.add((value as { mediaId: string }).mediaId);
      if (def.kind === "photoList") for (const p of value as Array<{ mediaId: string }>) ids.add(p.mediaId);
      if (def.kind === "riddleList") for (const r of value as Array<{ photo?: { mediaId: string } }>) if (r.photo) ids.add(r.photo.mediaId);
    }
    const map = new Map<string, { src: string; width?: number; height?: number }>();
    if (ids.size === 0) return map;
    const rows = await trx
      .selectFrom("app.media_assets")
      .select(["id", "status", "width", "height", "published_variants"])
      .where("id", "in", [...ids])
      .where("owner_id", "=", userId)
      .execute();
    for (const r of rows) {
      const src = r.published_variants?.lg ?? r.published_variants?.md;
      if (r.status === "ready" && src) map.set(r.id, { src, width: r.width ?? undefined, height: r.height ?? undefined });
    }
    const missing = [...ids].filter((id) => !map.has(id));
    if (missing.length) throw new ApiException("MEDIA_NOT_READY", { mediaIds: missing });
    return map;
  }
}

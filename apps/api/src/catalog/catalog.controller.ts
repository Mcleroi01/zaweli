import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  type CategoryResponse,
  type Locale,
  type PlanResponse,
  type TemplateDetailResponse,
  type TemplateSummaryResponse,
  translate,
} from "@zaweli/shared-types";
import type { TemplateManifest } from "@zaweli/template-engine/schema";
import { type Kysely, sql } from "kysely";
import { z } from "zod";
import { Public } from "../auth/auth.guard.js";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";
import { RequestLocale } from "../i18n/locale.js";

const slugSchema = z.string().regex(/^[a-z0-9-]{2,40}$/);

/**
 * Catalogue public (cahier des charges §7.3) et formules (§8.3), traduits
 * dans la langue de la requête. Seuls les modèles « published » ayant une
 * version courante et les formules actives et publiques sont visibles.
 */
@Controller()
export class CatalogController {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  @Public()
  @Get("catalog/categories")
  async categories(@RequestLocale() locale: Locale): Promise<CategoryResponse[]> {
    const rows = await this.db
      .selectFrom("app.template_categories")
      .select(["slug", "name", "description", "translations"])
      .where("is_active", "=", true)
      .orderBy("position")
      .execute();
    return rows.map((c) => this.category(c, locale));
  }

  @Public()
  @Get("catalog/templates")
  async templates(
    @RequestLocale() locale: Locale,
    @Query("category", { schema: slugSchema.optional() }) category?: string,
  ): Promise<TemplateSummaryResponse[]> {
    let query = this.templateQuery().orderBy("t.position").orderBy("t.slug");
    if (category) query = query.where("c.slug", "=", category);
    const rows = await query.execute();
    return rows.map((row) => this.summary(row, locale));
  }

  @Public()
  @Get("catalog/templates/:slug")
  async template(
    @RequestLocale() locale: Locale,
    @Param("slug", { schema: slugSchema }) slug: string,
  ): Promise<TemplateDetailResponse> {
    const row = await this.templateQuery().select("v.manifest").where("t.slug", "=", slug).executeTakeFirst();
    if (!row) throw new ApiException("TEMPLATE_NOT_FOUND");
    const manifest = row.manifest as unknown as TemplateManifest;
    const giftTypes = new Set<string>();
    for (const def of Object.values(manifest.fields)) if (def.kind === "giftList") def.types.forEach((t) => giftTypes.add(t));
    return {
      ...this.summary(row, locale),
      steps: manifest.steps.map((s) => ({ id: s.id, title: s.title, fields: [...s.fields] })),
      sections: manifest.sections.map((s) => ({ id: s.id, optional: s.optional })),
      maxPhotos: manifest.media.maxPhotos,
      giftTypes: [...giftTypes],
      fields: manifest.fields as unknown as TemplateDetailResponse["fields"],
    };
  }

  @Public()
  @Get("plans")
  async plans(@RequestLocale() locale: Locale): Promise<PlanResponse[]> {
    const plans = await this.db
      .selectFrom("app.plans")
      .selectAll()
      .where("is_active", "=", true)
      .where("is_public", "=", true)
      .orderBy("position")
      .execute();
    if (plans.length === 0) return [];
    const prices = await this.db
      .selectFrom("app.plan_prices")
      .select(["plan_id", "currency", sql<string>`amount::text`.as("amount")])
      .where(
        "plan_id",
        "in",
        plans.map((p) => p.id),
      )
      .where("valid_from", "<=", sql<Date>`now()`)
      .where((eb) => eb.or([eb("valid_to", "is", null), eb("valid_to", ">", sql<Date>`now()`)]))
      .orderBy("currency")
      .execute();
    return plans.map((p) => ({
      code: p.code,
      name: translate(p.translations, locale, "name", p.name),
      description: translate(p.translations, locale, "description", p.description),
      isFree: p.is_free,
      durationDays: p.duration_days,
      publicationsMax: p.publications_max,
      recipientsMax: p.recipients_max,
      aiGenerationsMax: p.ai_generations_max,
      templateAccess:
        p.template_access_mode === "all" ? { mode: "all" } : { mode: "tagged", tag: p.template_access_tag ?? "" },
      prices: prices.filter((x) => x.plan_id === p.id).map((x) => ({ currency: x.currency, amount: x.amount })),
    }));
  }

  private templateQuery() {
    return this.db
      .selectFrom("app.templates as t")
      .innerJoin("app.template_categories as c", "c.id", "t.category_id")
      .innerJoin("app.template_versions as v", "v.id", "t.current_version_id")
      .select([
        "t.id",
        "t.slug",
        "t.name",
        "t.description",
        "t.audience",
        "t.cover_path",
        "t.translations",
        "c.slug as category_slug",
        "c.name as category_name",
        "c.description as category_description",
        "c.translations as category_translations",
        "v.version",
        "v.renderer_key",
        (eb) =>
          eb
            .selectFrom("app.template_access_tags as tag")
            .select(sql<string[]>`coalesce(array_agg(tag.tag order by tag.tag), '{}')`.as("tags"))
            .whereRef("tag.template_id", "=", "t.id")
            .as("tags"),
      ])
      .where("t.status", "=", "published")
      .where("v.status", "=", "published");
  }

  private category(c: { slug: string; name: string; description: string | null; translations: unknown }, locale: Locale) {
    return {
      slug: c.slug,
      name: translate(c.translations, locale, "name", c.name),
      description: translate(c.translations, locale, "description", c.description),
    };
  }

  private summary(
    row: {
      slug: string;
      name: string;
      description: string | null;
      audience: "personal" | "business";
      cover_path: string | null;
      translations: unknown;
      category_slug: string;
      category_name: string;
      category_description: string | null;
      category_translations: unknown;
      version: string;
      renderer_key: string;
      tags: string[] | null;
    },
    locale: Locale,
  ): TemplateSummaryResponse {
    return {
      slug: row.slug,
      name: translate(row.translations, locale, "name", row.name),
      description: translate(row.translations, locale, "description", row.description),
      category: this.category(
        { slug: row.category_slug, name: row.category_name, description: row.category_description, translations: row.category_translations },
        locale,
      ),
      audience: row.audience,
      coverPath: row.cover_path,
      accessTags: row.tags ?? [],
      currentVersion: { version: row.version, rendererKey: row.renderer_key },
    };
  }
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiQuotaResponse, AiSuggestRequest, AiSuggestResponse, Locale } from "@zaweli/shared-types";
import type { TemplateManifest } from "@zaweli/template-engine/schema";
import { sql } from "kysely";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Db } from "../database/transaction.js";
import { type AiMessage, AiProvider } from "./ai.provider.js";

const TONES: Record<Locale, Record<AiSuggestRequest["tone"], string>> = {
  fr: { tender: "tendre et sincère", funny: "drôle et léger", solemn: "solennel et élégant", professional: "professionnel et chaleureux" },
  en: { tender: "tender and sincere", funny: "funny and light", solemn: "solemn and elegant", professional: "professional and warm" },
};
const LENGTH_SHARE = { short: 0.35, medium: 0.65, long: 0.95 } as const;

/**
 * Aide à l'écriture (§7.9) : uniquement les champs marqués « aiAssist » par
 * le modèle, sur une licence active qui a encore du quota (décompté en base,
 * rendu si la génération échoue). Le texte n'est jamais enregistré ici :
 * l'expéditeur le relit et décide de l'utiliser.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger("AI");

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly provider: AiProvider,
  ) {}

  async quota(userId: string): Promise<AiQuotaResponse> {
    const row = await this.licenseWithQuota(userId);
    return { available: this.provider.available, remaining: row ? row.left : 0 };
  }

  async suggest(userId: string, body: AiSuggestRequest): Promise<AiSuggestResponse> {
    if (!this.provider.available) throw new ApiException("AI_UNAVAILABLE");
    const e = await this.db
      .selectFrom("app.experiences as e")
      .innerJoin("app.template_versions as v", "v.id", "e.template_version_id")
      .innerJoin("app.templates as t", "t.id", "e.template_id")
      .innerJoin("app.recipients as r", "r.id", "e.recipient_id")
      .select(["e.id", "e.locale", "e.content", "v.manifest", "t.name as templateName", "r.display_name as recipient"])
      .where("e.id", "=", body.experienceId)
      .where("e.owner_id", "=", userId)
      .where("e.status", "in", ["draft", "published", "disabled"])
      .executeTakeFirst();
    if (!e) throw new ApiException("EXPERIENCE_NOT_FOUND");
    const def = (e.manifest as unknown as TemplateManifest).fields[body.fieldId];
    if (!def || (def.kind !== "shortText" && def.kind !== "longText") || !def.aiAssist) throw new ApiException("AI_FIELD_NOT_ALLOWED");

    const license = await this.licenseWithQuota(userId);
    if (!license) throw new ApiException("AI_QUOTA_EXCEEDED");
    const reserved = await sql<{ id: string }>`select app.reserve_ai_generation(${userId}::uuid, ${license.id}::uuid, ${"field_suggestion"}) as id`.execute(this.db);
    const generationId = reserved.rows[0]!.id;

    const max = def.max;
    const target = Math.max(20, Math.round(max * LENGTH_SHARE[body.length]));
    const current = typeof e.content.fields?.[body.fieldId] === "string" ? (e.content.fields[body.fieldId] as string) : "";
    try {
      const out = await this.provider.complete(this.prompt(e.locale, { template: e.templateName, recipient: e.recipient, label: def.label, current, target, max, ...body }), Math.ceil(max / 2) + 40);
      const text = clean(out.text, max);
      await sql`select app.settle_ai_generation(${generationId}::uuid, true, ${out.model}, ${out.promptTokens}, ${out.completionTokens})`.execute(this.db);
      return { text, remaining: license.left - 1 };
    } catch (err) {
      this.logger.warn(`suggestion impossible : ${(err as Error).message}`);
      // Un échec ne consomme pas le quota.
      await sql`select app.settle_ai_generation(${generationId}::uuid, false, null, null, null, null, ${"provider_error"})`.execute(this.db);
      throw new ApiException("AI_UNAVAILABLE");
    }
  }

  /** Licence active avec du quota restant, celle qui expire en premier. */
  private async licenseWithQuota(userId: string) {
    const row = await this.db
      .selectFrom("app.licenses")
      .select(["id", sql<number>`(ai_generations_max - ai_generations_used)::int`.as("left")])
      .where("user_id", "=", userId)
      .where("status", "=", "active")
      .where((eb) => eb.or([eb("ends_at", "is", null), eb("ends_at", ">", sql<Date>`now()`)]))
      .where(sql<boolean>`ai_generations_used < ai_generations_max`)
      .orderBy(sql`ends_at asc nulls last`)
      .executeTakeFirst();
    return row ?? null;
  }

  private prompt(
    locale: Locale,
    c: { template: string; recipient: string; label: string; current: string; target: number; max: number; tone: AiSuggestRequest["tone"]; hint?: string },
  ): AiMessage[] {
    const fr = locale === "fr";
    const system = fr
      ? "Tu aides une personne à écrire un texte pour une surprise numérique qu'elle offre à un proche. Tu écris en français, au tutoiement, sans emoji, sans guillemets autour du texte, sans inventer de faits précis (dates, lieux, noms) qui ne te sont pas donnés. Tu réponds uniquement par le texte proposé."
      : "You help someone write a text for a digital surprise they are giving to a loved one. You write in English, without emoji, without quotes around the text, without inventing precise facts (dates, places, names) you were not given. You reply with the proposed text only.";
    const user = fr
      ? [
          `Champ à remplir : « ${c.label} » (modèle ${c.template}).`,
          `Personne qui reçoit : ${c.recipient}.`,
          `Ton : ${TONES.fr[c.tone]}.`,
          `Longueur visée : environ ${c.target} caractères, ${c.max} au maximum.`,
          c.hint ? `Précisions de l'expéditeur : ${c.hint}` : "",
          c.current ? `Texte actuel, à améliorer ou à reformuler : ${c.current}` : "",
        ]
      : [
          `Field to fill: "${c.label}" (template ${c.template}).`,
          `Person receiving it: ${c.recipient}.`,
          `Tone: ${TONES.en[c.tone]}.`,
          `Target length: about ${c.target} characters, ${c.max} at most.`,
          c.hint ? `Details from the sender: ${c.hint}` : "",
          c.current ? `Current text, to improve or rephrase: ${c.current}` : "",
        ];
    return [
      { role: "system", content: system },
      { role: "user", content: user.filter(Boolean).join("\n") },
    ];
  }
}

/** Retire guillemets d'enrobage et espaces, et respecte la longueur du champ (coupe à un mot). */
export function clean(text: string, max: number): string {
  let t = text.trim().replace(/^["«“]\s*|\s*["»”]$/g, "").trim();
  if (t.length > max) {
    t = t.slice(0, max);
    const cut = t.lastIndexOf(" ");
    if (cut > max * 0.6) t = t.slice(0, cut);
    t = t.replace(/[\s,;:]+$/, "");
  }
  return t;
}

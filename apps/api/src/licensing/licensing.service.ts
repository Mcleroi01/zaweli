import { Inject, Injectable } from "@nestjs/common";
import type { EligibilityResponse, LicenseResponse } from "@zaweli/shared-types";
import { sql } from "kysely";
import { DB } from "../database/database.module.js";
import type { LicensesTable } from "../database/database.types.js";
import { type Db, type Tx, toIso } from "../database/transaction.js";

type LicenseRow = {
  id: string;
  user_id: string;
  source: LicensesTable["source"];
  status: LicensesTable["status"];
  starts_at: Date | null;
  ends_at: Date | null;
  publications_max: number | null;
  publications_used: number;
  recipients_max: number | null;
  template_access_mode: "all" | "tagged";
  template_access_tag: string | null;
  edit_policy: "while_valid" | "days" | "never";
  edit_days: number | null;
  max_publications_per_day: number;
  plan_code: string;
  plan_name: string;
};

export type EligibilityTarget = { templateId: string; recipientId: string };

/**
 * Droits CRÉER / PUBLIER / MODIFIER (cahier des charges §8). Ce service sert
 * à l'AFFICHAGE (quelles licences peuvent couvrir une publication) ; la
 * décision définitive est toujours rejouée en base, sous verrou, par
 * app.consume_publication au moment de publier (principe P4).
 */
@Injectable()
export class LicensingService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Droit FREE : créé à la demande pour un compte à l'e-mail vérifié.
   * Renvoie null si la formule gratuite n'est pas configurée ou si l'e-mail
   * n'est pas confirmé (aucune erreur : l'utilisateur garde ses autres licences).
   */
  async ensureFreeLicense(db: Db | Tx, userId: string): Promise<{ id: string | null; reason: "unverified" | "unconfigured" | null }> {
    const { rows } = await sql<{ verified: boolean; configured: boolean }>`
      select app.is_email_confirmed(${userId}::uuid) as verified,
             exists (select 1 from app.plans where is_free and is_active) as configured`.execute(db);
    const state = rows[0]!;
    if (!state.configured) return { id: null, reason: "unconfigured" };
    if (!state.verified) return { id: null, reason: "unverified" };
    const created = await sql<{ id: string }>`select app.ensure_free_license(${userId}::uuid) as id`.execute(db);
    return { id: created.rows[0]!.id, reason: null };
  }

  /** Licences actives qui couvrent cette publication, triées : celle qui expire en premier d'abord, FREE à part. */
  async eligibility(userId: string, target: EligibilityTarget): Promise<EligibilityResponse> {
    const free = await this.ensureFreeLicense(this.db, userId);
    const licenses = await this.activeLicenses(this.db, userId);
    const tags = await this.templateTags(this.db, target.templateId);
    const candidates: EligibilityResponse["candidates"] = [];

    for (const l of licenses) {
      if (!(await this.covers(this.db, l, target, tags))) continue;
      candidates.push({
        licenseId: l.id,
        planCode: l.plan_code,
        planName: l.plan_name,
        source: l.source,
        endsAt: toIso(l.ends_at),
        publicationsLeft: l.publications_max == null ? null : l.publications_max - l.publications_used,
        requiresExplicitChoice: l.source === "free",
      });
    }

    candidates.sort((a, b) => {
      if (a.requiresExplicitChoice !== b.requiresExplicitChoice) return a.requiresExplicitChoice ? 1 : -1;
      return (a.endsAt ?? "9999").localeCompare(b.endsAt ?? "9999");
    });
    const defaultLicense = candidates.find((c) => !c.requiresExplicitChoice) ?? null;
    let reason: string | null = null;
    if (candidates.length === 0) reason = free.reason === "unverified" ? "FREE_LICENSE_REQUIRES_VERIFIED_EMAIL" : "NO_ELIGIBLE_LICENSE";
    return { candidates, defaultLicenseId: defaultLicense?.licenseId ?? null, reason };
  }

  /** Choix de la licence à la publication (§8.4). Lève NO_ELIGIBLE_LICENSE si rien ne convient. */
  async pickLicense(
    trx: Tx,
    userId: string,
    target: EligibilityTarget,
    choice: { licenseId?: string; useFree?: boolean },
  ): Promise<{ id: string | null; reason: "FREE_LICENSE_REQUIRES_VERIFIED_EMAIL" | "NO_ELIGIBLE_LICENSE" | null }> {
    if (choice.licenseId) return { id: choice.licenseId, reason: null };
    const free = choice.useFree ? await this.ensureFreeLicense(trx, userId) : null;
    const tags = await this.templateTags(trx, target.templateId);
    const licenses = (await this.activeLicenses(trx, userId))
      .filter((l) => (choice.useFree ? l.source === "free" : l.source !== "free"))
      .sort((a, b) => (a.ends_at?.getTime() ?? Infinity) - (b.ends_at?.getTime() ?? Infinity));
    for (const l of licenses) if (await this.covers(trx, l, target, tags)) return { id: l.id, reason: null };
    if (choice.useFree && free?.reason === "unverified") return { id: null, reason: "FREE_LICENSE_REQUIRES_VERIFIED_EMAIL" };
    return { id: null, reason: "NO_ELIGIBLE_LICENSE" };
  }

  /**
   * Droit MODIFIER d'une expérience déjà publiée : licence qui l'a couverte,
   * encore valide, selon sa politique (pendant la validité, N jours, jamais).
   * Un brouillon reste toujours modifiable (§8.4 : on peut finir son brouillon).
   */
  async canEdit(
    db: Db | Tx,
    experience: { id: string; status: string; first_published_at: Date | null },
  ): Promise<boolean> {
    if (experience.status === "draft") return true;
    if (experience.status !== "published" && experience.status !== "disabled") return false;
    const license = await db
      .selectFrom("app.license_consumptions as c")
      .innerJoin("app.licenses as l", "l.id", "c.license_id")
      .select(["l.status", "l.ends_at", "l.edit_policy", "l.edit_days"])
      .where("c.experience_id", "=", experience.id)
      .executeTakeFirst();
    if (!license || license.status !== "active") return false;
    const now = Date.now();
    if (license.ends_at && new Date(license.ends_at).getTime() <= now) return false;
    switch (license.edit_policy) {
      case "never":
        return false;
      case "days": {
        const since = experience.first_published_at ? new Date(experience.first_published_at).getTime() : now;
        return now < since + (license.edit_days ?? 0) * 86_400_000;
      }
      default:
        return true;
    }
  }

  async listForUser(userId: string): Promise<LicenseResponse[]> {
    await this.ensureFreeLicense(this.db, userId);
    const rows = await this.db
      .selectFrom("app.licenses as l")
      .innerJoin("app.plans as p", "p.id", "l.plan_id")
      .select([
        "l.id",
        "l.source",
        "l.status",
        "l.starts_at",
        "l.ends_at",
        "l.publications_used",
        "l.publications_max",
        "l.recipients_max",
        "l.ai_generations_used",
        "l.ai_generations_max",
        "p.code",
        "p.name",
      ])
      .where("l.user_id", "=", userId)
      .orderBy("l.created_at", "desc")
      .execute();
    const bound = rows.length
      ? await this.db
          .selectFrom("app.license_recipients as lr")
          .innerJoin("app.recipients as r", "r.id", "lr.recipient_id")
          .select(["lr.license_id", "r.id", "r.display_name"])
          .where(
            "lr.license_id",
            "in",
            rows.map((r) => r.id),
          )
          .execute()
      : [];
    return rows.map((l) => ({
      id: l.id,
      plan: { code: l.code, name: l.name },
      source: l.source,
      status: l.status,
      startsAt: toIso(l.starts_at),
      endsAt: toIso(l.ends_at),
      publications: { used: l.publications_used, max: l.publications_max },
      recipients: {
        bound: bound.filter((b) => b.license_id === l.id).map((b) => ({ id: b.id, displayName: b.display_name })),
        max: l.recipients_max,
      },
      ai: { used: l.ai_generations_used, max: l.ai_generations_max },
    }));
  }

  private activeLicenses(db: Db | Tx, userId: string): Promise<LicenseRow[]> {
    return db
      .selectFrom("app.licenses as l")
      .innerJoin("app.plans as p", "p.id", "l.plan_id")
      .select([
        "l.id",
        "l.user_id",
        "l.source",
        "l.status",
        "l.starts_at",
        "l.ends_at",
        "l.publications_max",
        "l.publications_used",
        "l.recipients_max",
        "l.template_access_mode",
        "l.template_access_tag",
        "l.edit_policy",
        "l.edit_days",
        "l.max_publications_per_day",
        "p.code as plan_code",
        "p.name as plan_name",
      ])
      .where("l.user_id", "=", userId)
      .where("l.status", "=", "active")
      .where((eb) => eb.or([eb("l.ends_at", "is", null), eb("l.ends_at", ">", sql<Date>`now()`)]))
      .where((eb) => eb.or([eb("l.starts_at", "is", null), eb("l.starts_at", "<=", sql<Date>`now()`)]))
      .execute() as Promise<LicenseRow[]>;
  }

  private async templateTags(db: Db | Tx, templateId: string): Promise<Set<string>> {
    const rows = await db.selectFrom("app.template_access_tags").select("tag").where("template_id", "=", templateId).execute();
    return new Set(rows.map((r) => r.tag));
  }

  /** Mêmes règles que app.consume_publication, sans verrou (affichage). */
  private async covers(db: Db | Tx, l: LicenseRow, target: EligibilityTarget, tags: Set<string>): Promise<boolean> {
    if (l.template_access_mode === "tagged" && !tags.has(l.template_access_tag ?? "")) return false;
    if (l.publications_max != null && l.publications_used >= l.publications_max) return false;
    const { rows } = await sql<{ today: number; bound: number; mine: boolean }>`
      select (select count(*)::int from app.license_consumptions c
               where c.license_id = ${l.id}::uuid and c.consumed_at > now() - interval '24 hours') as today,
             (select count(*)::int from app.license_recipients r where r.license_id = ${l.id}::uuid) as bound,
             exists (select 1 from app.license_recipients r
                      where r.license_id = ${l.id}::uuid and r.recipient_id = ${target.recipientId}::uuid) as mine`.execute(db);
    const s = rows[0]!;
    if (s.today >= l.max_publications_per_day) return false;
    if (l.recipients_max != null && !s.mine && s.bound >= l.recipients_max) return false;
    return true;
  }
}

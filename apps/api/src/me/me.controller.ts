import { Body, Controller, Get, Inject, Patch, Req } from "@nestjs/common";
import {
  type MeResponse,
  type ProfileResponse,
  type UpdateProfileRequest,
  updateProfileSchema,
} from "@zaweli/shared-types";
import type { Request } from "express";
import { type Kysely, sql } from "kysely";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";
import { ENV, type Env } from "../config/env.js";
import { requestCountry } from "../geo/request-country.js";

@Controller("me")
export class MeController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** GET /v1/me : l'utilisateur authentifié et ses rôles applicatifs (lus en base). */
  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const rows = await this.db.selectFrom("app.user_roles").select("role").where("user_id", "=", user.id).execute();
    return { id: user.id, email: user.email, roles: rows.map((r) => r.role) };
  }

  /** GET /v1/me/profile : nom affiché, langue préférée (fr | en), préférences. */
  @Get("profile")
  async profile(@CurrentUser() user: AuthenticatedUser, @Req() req: Request): Promise<ProfileResponse> {
    await this.detectCountry(user.id, req);
    return this.read(user);
  }

  /** PATCH /v1/me/profile : la langue choisie ici pilote l'interface et les e-mails. */
  @Patch("profile")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body({ schema: updateProfileSchema }) body: UpdateProfileRequest,
  ): Promise<ProfileResponse> {
    // Le profil est créé par le déclencheur d'inscription ; on le recrée au besoin (idempotent).
    await this.db.insertInto("app.profiles").values({ id: user.id }).onConflict((oc) => oc.column("id").doNothing()).execute();
    await this.db
      .updateTable("app.profiles")
      .set({
        ...(body.displayName !== undefined ? { display_name: body.displayName } : {}),
        ...(body.locale ? { locale: body.locale } : {}),
        ...(body.marketingOptIn !== undefined ? { marketing_opt_in: body.marketingOptIn } : {}),
        // Un pays déclaré l'emporte toujours sur la détection ; l'effacer rend la main à la détection.
        ...(body.countryCode !== undefined
          ? { country_code: body.countryCode, country_source: body.countryCode ? ("declared" as const) : null }
          : {}),
      })
      .where("id", "=", user.id)
      .execute();
    if (body.countryCode === null) await this.detectCountry(user.id, req);
    return this.read(user);
  }

  /** Pré-remplit le pays d'un compte qui n'en a aucun, d'après le CDN. N'écrase jamais un pays existant. */
  private async detectCountry(userId: string, req: Request): Promise<void> {
    const country = requestCountry(req, this.env.GEO_COUNTRY_HEADER);
    if (!country) return;
    await this.db
      .updateTable("app.profiles")
      .set({ country_code: country, country_source: "detected" })
      .where("id", "=", userId)
      .where("country_code", "is", null)
      .execute();
  }

  private async read(user: AuthenticatedUser): Promise<ProfileResponse> {
    const row = await this.db
      .selectFrom("app.profiles")
      .select(["display_name", "locale", "marketing_opt_in", "country_code", "country_source", sql<boolean>`app.is_email_confirmed(id)`.as("verified")])
      .where("id", "=", user.id)
      .executeTakeFirst();
    return {
      id: user.id,
      email: user.email,
      displayName: row?.display_name ?? null,
      locale: row?.locale ?? "fr",
      marketingOptIn: row?.marketing_opt_in ?? false,
      emailVerified: row?.verified ?? false,
      countryCode: row?.country_code ?? null,
      countrySource: row?.country_source ?? null,
    };
  }
}

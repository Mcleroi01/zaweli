import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import {
  type MeResponse,
  type ProfileResponse,
  type UpdateProfileRequest,
  updateProfileSchema,
} from "@zaweli/shared-types";
import { type Kysely, sql } from "kysely";
import { CurrentUser } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt-verifier.service.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";

@Controller("me")
export class MeController {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  /** GET /v1/me : l'utilisateur authentifié et ses rôles applicatifs (lus en base). */
  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const rows = await this.db.selectFrom("app.user_roles").select("role").where("user_id", "=", user.id).execute();
    return { id: user.id, email: user.email, roles: rows.map((r) => r.role) };
  }

  /** GET /v1/me/profile : nom affiché, langue préférée (fr | en), préférences. */
  @Get("profile")
  profile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return this.read(user);
  }

  /** PATCH /v1/me/profile : la langue choisie ici pilote l'interface et les e-mails. */
  @Patch("profile")
  async update(
    @CurrentUser() user: AuthenticatedUser,
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
      })
      .where("id", "=", user.id)
      .execute();
    return this.read(user);
  }

  private async read(user: AuthenticatedUser): Promise<ProfileResponse> {
    const row = await this.db
      .selectFrom("app.profiles")
      .select(["display_name", "locale", "marketing_opt_in", sql<boolean>`app.is_email_confirmed(id)`.as("verified")])
      .where("id", "=", user.id)
      .executeTakeFirst();
    return {
      id: user.id,
      email: user.email,
      displayName: row?.display_name ?? null,
      locale: row?.locale ?? "fr",
      marketingOptIn: row?.marketing_opt_in ?? false,
      emailVerified: row?.verified ?? false,
    };
  }
}

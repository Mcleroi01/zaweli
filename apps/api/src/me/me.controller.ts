import { Controller, Get, Inject } from "@nestjs/common";
import type { MeResponse } from "@zaweli/shared-types";
import type { Kysely } from "kysely";
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
}

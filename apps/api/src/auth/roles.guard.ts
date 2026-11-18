import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Kysely } from "kysely";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";
import type { AuthenticatedUser } from "./jwt-verifier.service.js";

type Role = "admin" | "support";
const ROLES = "zaweli:roles";

/** Rôles applicatifs exigés (au moins un). Lus EN BASE, jamais depuis le jeton. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** À placer après la garde d'authentification globale : @UseGuards(RolesGuard). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Kysely<Database>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    const user = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user) throw new ApiException("UNAUTHENTICATED");
    const row = await this.db
      .selectFrom("app.user_roles")
      .select("role")
      .where("user_id", "=", user.id)
      .where("role", "in", required)
      .executeTakeFirst();
    if (!row) throw new ApiException("FORBIDDEN");
    return true;
  }
}

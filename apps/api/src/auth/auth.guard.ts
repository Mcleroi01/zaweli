import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ApiException } from "../common/api-exception.js";
import { type AuthenticatedUser, JwtVerifierService } from "./jwt-verifier.service.js";

const IS_PUBLIC = "zaweli:isPublic";

/** Route accessible sans authentification (santé, pages publiques…). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

type AuthedRequest = Request & { user?: AuthenticatedUser };

/** Utilisateur authentifié de la requête (garanti par AuthGuard). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new ApiException("UNAUTHENTICATED");
  return user;
});

/**
 * Garde GLOBALE : toute route exige un jeton valide, sauf @Public().
 * Sécurisé par défaut : oublier un décorateur ne peut pas ouvrir une route.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new ApiException("UNAUTHENTICATED");
    }
    try {
      req.user = await this.verifier.verify(token);
      return true;
    } catch {
      throw new ApiException("UNAUTHENTICATED");
    }
  }
}

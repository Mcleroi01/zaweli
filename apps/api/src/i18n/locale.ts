import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type Locale, resolveLocale } from "@zaweli/shared-types";
import type { Request } from "express";

/**
 * Langue d'une requête : paramètre `?lang=fr|en`, sinon Accept-Language,
 * sinon français. Sert aux messages d'erreur et aux textes traduits du
 * catalogue (noms de modèles, de catégories, de formules).
 */
export function requestLocale(req: Request): Locale {
  const lang = typeof req.query?.lang === "string" ? req.query.lang : null;
  const header = req.headers["accept-language"];
  return resolveLocale(lang, typeof header === "string" ? header : null);
}

export const RequestLocale = createParamDecorator((_: unknown, ctx: ExecutionContext): Locale =>
  requestLocale(ctx.switchToHttp().getRequest<Request>()),
);

/** Identifiant de requête (propagé dans les journaux et l'audit). */
export const RequestId = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const id = ctx.switchToHttp().getRequest<Request>().headers["x-request-id"];
  return typeof id === "string" ? id : null;
});

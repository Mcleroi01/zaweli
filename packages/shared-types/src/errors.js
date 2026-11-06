import { z } from "zod";
/**
 * Codes d'erreur métier stables, partagés entre l'API et le web.
 * Les codes « base de données » sont ceux levés par les fonctions et
 * déclencheurs SQL (supabase/migrations) : ils doivent rester identiques.
 */
export const ERROR_CODES = [
    // Génériques
    "VALIDATION_FAILED",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "RATE_LIMITED",
    "INTERNAL_ERROR",
    "SERVICE_UNAVAILABLE",
    // Licences (fonction app.consume_publication)
    "FREE_PLAN_NOT_CONFIGURED",
    "LICENSE_NOT_FOUND",
    "LICENSE_NOT_ACTIVE",
    "LICENSE_NOT_STARTED",
    "LICENSE_EXPIRED",
    "LICENSE_TEMPLATE_NOT_ALLOWED",
    "LICENSE_PUBLICATION_LIMIT_REACHED",
    "LICENSE_DAILY_LIMIT_REACHED",
    "LICENSE_RECIPIENT_LIMIT_REACHED",
    "LICENSE_ORDER_NOT_PAID",
    "EXPERIENCE_NOT_FOUND",
    "EXPERIENCE_ALREADY_CONSUMED",
    "EXPERIENCE_NOT_DRAFT",
    // Commandes
    "ORDER_NOT_FOUND",
    "ORDER_KIND_NOT_LICENSE",
    // IA
    "AI_QUOTA_EXCEEDED",
    "AI_GENERATION_NOT_FOUND",
    // Cadeaux
    "GIFT_TYPE_DISABLED",
    "GIFT_INVALID_INITIAL_STATUS",
    "GIFT_TYPE_IMMUTABLE",
    "GIFT_TRANSITION_NOT_ALLOWED",
    "GIFT_STATUS_REQUIRES_PROVIDER",
    "GIFT_MONEY_REQUIRES_AMOUNT",
    "MONEY_TRANSFERS_DISABLED",
    // Catalogue
    "TEMPLATE_VERSION_IMMUTABLE",
];
export const errorCodeSchema = z.enum(ERROR_CODES);
/** Format unique des erreurs de l'API : { error: { code, message, details? } }. */
export const apiErrorSchema = z.object({
    error: z.object({
        code: errorCodeSchema,
        message: z.string(),
        details: z.unknown().optional(),
        requestId: z.string().optional(),
    }),
});
export const isErrorCode = (value) => ERROR_CODES.includes(value);
//# sourceMappingURL=errors.js.map
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
  "TEMPLATE_NOT_FOUND",
  "TEMPLATE_NOT_AVAILABLE",
  "PLAN_NOT_FOUND",
  // Destinataires
  "RECIPIENT_NOT_FOUND",
  "RECIPIENT_IN_USE",
  // Expériences (API)
  "DRAFT_LIMIT_REACHED",
  "EXPERIENCE_NOT_EDITABLE",
  "EXPERIENCE_CONTENT_INVALID",
  "EXPERIENCE_REVISION_CONFLICT",
  "EXPERIENCE_STATUS_CONFLICT",
  "MEDIA_NOT_READY",
  "NO_ELIGIBLE_LICENSE",
  "FREE_LICENSE_REQUIRES_VERIFIED_EMAIL",
  // Cadeaux (API)
  "GIFT_NOT_FOUND",
  "GIFT_TYPE_NOT_ACCEPTED",
  "GIFT_LIMIT_REACHED",
  "GIFT_NOT_PROTECTED",
  // Modération
  "REPORT_NOT_FOUND",
  "REPORT_ALREADY_HANDLED",
  // Statistiques et finances (administration)
  "EXCHANGE_RATE_EXISTS",
  // Paiements (MbiyoPay)
  "PAYMENTS_UNAVAILABLE",
  "PLAN_PRICE_NOT_FOUND",
  "PAYMENT_AMOUNT_OUT_OF_RANGE",
  "PAYMENT_REJECTED",
  "PAYMENT_NOT_PENDING",
  "MONEY_FEES_NOT_CONFIGURED",
  "GIFT_LOCKED",
  "GIFT_NOT_FUNDABLE",
  "GIFT_NOT_CLAIMABLE",
  // Ouverture de l'expérience (destinataire)
  "ACCESS_CODE_REQUIRED",
  "ACCESS_CODE_INVALID",
  "NOT_YET_AVAILABLE",
  // Aide à l'écriture
  "AI_UNAVAILABLE",
  "AI_FIELD_NOT_ALLOWED",
  // Compte
  "ACCOUNT_SUSPENDED",
  "USER_NOT_FOUND",
  "ACCOUNT_HAS_PENDING_MONEY",
  // Photos
  "MEDIA_UNAVAILABLE",
  "MEDIA_NOT_FOUND",
  "MEDIA_REJECTED",
  "MEDIA_LIMIT_REACHED",
  // Parrainage et cartes cadeaux
  "REFERRAL_CODE_INVALID",
  "REFERRAL_NOT_ALLOWED",
  "ORDER_NOT_CREDIT_COVERED",
  "PAYER_REQUIRED",
  "MOBILE_MONEY_CURRENCY_UNSUPPORTED",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Format unique des erreurs de l'API : { error: { code, message, details? } }. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const isErrorCode = (value: string): value is ErrorCode =>
  (ERROR_CODES as readonly string[]).includes(value);

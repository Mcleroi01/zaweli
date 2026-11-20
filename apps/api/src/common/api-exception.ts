import { HttpException, HttpStatus } from "@nestjs/common";
import { DEFAULT_LOCALE, type ErrorCode, errorMessage } from "@zaweli/shared-types";

const STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  EXPERIENCE_CONTENT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  PAYMENTS_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  MONEY_FEES_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  PAYMENT_REJECTED: HttpStatus.UNPROCESSABLE_ENTITY,
  PAYMENT_AMOUNT_OUT_OF_RANGE: HttpStatus.UNPROCESSABLE_ENTITY,
  MOBILE_MONEY_CURRENCY_UNSUPPORTED: HttpStatus.UNPROCESSABLE_ENTITY,
  PAYER_REQUIRED: HttpStatus.UNPROCESSABLE_ENTITY,
  REFERRAL_CODE_INVALID: HttpStatus.NOT_FOUND,
  MEDIA_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  ACCESS_CODE_REQUIRED: HttpStatus.UNAUTHORIZED,
  ACCOUNT_SUSPENDED: HttpStatus.FORBIDDEN,
  AI_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  AI_FIELD_NOT_ALLOWED: HttpStatus.UNPROCESSABLE_ENTITY,
  ACCESS_CODE_INVALID: HttpStatus.FORBIDDEN,
  NOT_YET_AVAILABLE: HttpStatus.LOCKED,
  MEDIA_REJECTED: HttpStatus.UNPROCESSABLE_ENTITY,
};

/** Statut HTTP d'un code métier : *_NOT_FOUND → 404, règles métier → 409. */
export function statusForCode(code: ErrorCode): HttpStatus {
  return STATUS[code] ?? (code.endsWith("_NOT_FOUND") ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT);
}

/**
 * Erreur métier de l'API, rendue au format { error: { code, message, details? } }.
 * Le message est choisi par le filtre dans la langue de la requête, à partir
 * du code : un code = une phrase traduite (packages/shared-types/messages.ts).
 */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly details?: unknown,
  ) {
    const message = errorMessage(code, DEFAULT_LOCALE);
    super({ code, message, details }, statusForCode(code));
  }
}

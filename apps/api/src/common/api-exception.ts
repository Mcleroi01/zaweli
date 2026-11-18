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

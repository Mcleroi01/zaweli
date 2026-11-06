import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorCode } from "@zaweli/shared-types";

const STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
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

/** Erreur métier de l'API, rendue au format { error: { code, message, details? } }. */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, statusForCode(code));
  }
}

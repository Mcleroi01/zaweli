import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { type ApiError, type ErrorCode, isErrorCode } from "@zaweli/shared-types";
import type { Request, Response } from "express";
import { ApiException, statusForCode } from "./api-exception.js";

const BY_STATUS: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: "Les données envoyées sont invalides.",
  UNAUTHENTICATED: "Authentification requise.",
  FORBIDDEN: "Accès refusé.",
  NOT_FOUND: "Ressource introuvable.",
  CONFLICT: "Conflit avec l'état actuel.",
  RATE_LIMITED: "Trop de requêtes. Réessaie dans un instant.",
  INTERNAL_ERROR: "Une erreur inattendue est survenue.",
  SERVICE_UNAVAILABLE: "Service momentanément indisponible.",
};

type PgLikeError = { code?: unknown; message?: unknown };

/**
 * Format UNIQUE des erreurs : { error: { code, message, details?, requestId } }.
 * - Erreurs métier (ApiException) : rendues telles quelles.
 * - Erreurs métier levées par PostgreSQL (SQLSTATE P0001 + code connu) :
 *   traduites en code métier (ex. LICENSE_RECIPIENT_LIMIT_REACHED → 409).
 * - Tout le reste : 500 INTERNAL_ERROR, sans fuite de détail technique.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = String(req.headers["x-request-id"] ?? "");

    const { status, body } = this.toApiError(exception);
    if (status >= 500) {
      this.logger.error({ requestId, path: req.url, err: exception instanceof Error ? exception.stack : exception });
    }
    if (requestId) body.error.requestId = requestId;
    res.status(status).json(body);
  }

  toApiError(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof ApiException) {
      return this.build(exception.getStatus(), exception.code, exception.message, exception.details);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = BY_STATUS[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_FAILED");
      const response = exception.getResponse();
      const details =
        typeof response === "object" && response !== null && "issues" in response
          ? (response as { issues: unknown }).issues
          : undefined;
      return this.build(status, code, MESSAGES[code] ?? exception.message, details);
    }

    const pgError = exception as PgLikeError;
    if (pgError?.code === "P0001" && typeof pgError.message === "string" && isErrorCode(pgError.message)) {
      const code = pgError.message;
      return this.build(statusForCode(code), code, code);
    }

    return this.build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", MESSAGES.INTERNAL_ERROR!);
  }

  private build(status: number, code: ErrorCode, message: string, details?: unknown) {
    const body: ApiError = { error: { code, message } };
    if (details !== undefined) body.error.details = details;
    return { status, body };
  }
}

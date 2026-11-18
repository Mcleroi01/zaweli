import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { type ApiError, DEFAULT_LOCALE, type ErrorCode, errorMessage, isErrorCode, type Locale } from "@zaweli/shared-types";
import type { Request, Response } from "express";
import { requestLocale } from "../i18n/locale.js";
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

type PgLikeError = { code?: unknown; message?: unknown };

/**
 * Format UNIQUE des erreurs : { error: { code, message, details?, requestId } },
 * avec un message dans la langue de la requête (?lang, Accept-Language).
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

    const locale = requestLocale(req);
    const { status, body } = this.toApiError(exception, locale);
    if (status >= 500) {
      this.logger.error({ requestId, path: req.url, err: exception instanceof Error ? exception.stack : exception });
    }
    if (requestId) body.error.requestId = requestId;
    res.setHeader("content-language", locale);
    res.status(status).json(body);
  }

  toApiError(exception: unknown, locale: Locale = DEFAULT_LOCALE): { status: number; body: ApiError } {
    const build = (status: number, code: ErrorCode, details?: unknown) => {
      const body: ApiError = { error: { code, message: errorMessage(code, locale) } };
      if (details !== undefined) body.error.details = details;
      return { status, body };
    };

    if (exception instanceof ApiException) return build(exception.getStatus(), exception.code, exception.details);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = BY_STATUS[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_FAILED");
      const response = exception.getResponse();
      const details =
        typeof response === "object" && response !== null && "issues" in response
          ? (response as { issues: unknown }).issues
          : undefined;
      return build(status, code, details);
    }

    const pgError = exception as PgLikeError;
    if (pgError?.code === "P0001" && typeof pgError.message === "string" && isErrorCode(pgError.message)) {
      return build(statusForCode(pgError.message), pgError.message);
    }

    return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
  }
}

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ApiException } from "./api-exception.js";
import { ApiExceptionFilter } from "./api-exception.filter.js";

const filter = new ApiExceptionFilter();

describe("ApiExceptionFilter", () => {
  it("rend une ApiException telle quelle", () => {
    const { status, body } = filter.toApiError(new ApiException("UNAUTHENTICATED", "Session expirée."));
    expect(status).toBe(401);
    expect(body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Session expirée." } });
  });

  it("traduit les erreurs métier levées par PostgreSQL", () => {
    const pg = Object.assign(new Error("LICENSE_RECIPIENT_LIMIT_REACHED"), { code: "P0001" });
    expect(filter.toApiError(pg)).toMatchObject({ status: 409, body: { error: { code: "LICENSE_RECIPIENT_LIMIT_REACHED" } } });

    const notFound = Object.assign(new Error("LICENSE_NOT_FOUND"), { code: "P0001" });
    expect(filter.toApiError(notFound).status).toBe(404);
  });

  it("ne transforme pas un message P0001 inconnu en code métier", () => {
    const unknown = Object.assign(new Error("quelque chose"), { code: "P0001" });
    expect(filter.toApiError(unknown)).toMatchObject({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
  });

  it("normalise les exceptions HTTP de Nest", () => {
    expect(filter.toApiError(new NotFoundException()).body.error.code).toBe("NOT_FOUND");
    expect(filter.toApiError(new BadRequestException()).body.error.code).toBe("VALIDATION_FAILED");
  });

  it("ne divulgue pas le détail d'une erreur inattendue", () => {
    const { status, body } = filter.toApiError(new Error("connexion refusée à 10.0.0.3:5432"));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("10.0.0.3");
  });
});

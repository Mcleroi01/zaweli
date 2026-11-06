import { z } from "zod";
export const healthStatusSchema = z.enum(["ok", "degraded", "down"]);
/** Réponse de GET /v1/health. */
export const healthResponseSchema = z.object({
    status: healthStatusSchema,
    version: z.string(),
    time: z.string(),
    checks: z.object({
        database: z.object({
            status: healthStatusSchema,
            latencyMs: z.number().nonnegative().optional(),
            migrations: z.number().int().nonnegative().optional(),
        }),
    }),
});
/** Réponse de GET /v1/me (utilisateur authentifié). */
export const meResponseSchema = z.object({
    id: z.uuid(),
    email: z.string().nullable(),
    roles: z.array(z.enum(["admin", "support"])),
});
//# sourceMappingURL=health.js.map
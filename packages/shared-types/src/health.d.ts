import { z } from "zod";
export declare const healthStatusSchema: z.ZodEnum<{
    ok: "ok";
    degraded: "degraded";
    down: "down";
}>;
/** Réponse de GET /v1/health. */
export declare const healthResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ok: "ok";
        degraded: "degraded";
        down: "down";
    }>;
    version: z.ZodString;
    time: z.ZodString;
    checks: z.ZodObject<{
        database: z.ZodObject<{
            status: z.ZodEnum<{
                ok: "ok";
                degraded: "degraded";
                down: "down";
            }>;
            latencyMs: z.ZodOptional<z.ZodNumber>;
            migrations: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
/** Réponse de GET /v1/me (utilisateur authentifié). */
export declare const meResponseSchema: z.ZodObject<{
    id: z.ZodUUID;
    email: z.ZodNullable<z.ZodString>;
    roles: z.ZodArray<z.ZodEnum<{
        admin: "admin";
        support: "support";
    }>>;
}, z.core.$strip>;
export type MeResponse = z.infer<typeof meResponseSchema>;
//# sourceMappingURL=health.d.ts.map
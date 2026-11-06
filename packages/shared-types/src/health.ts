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
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Réponse de GET /v1/me (utilisateur authentifié). */
export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  roles: z.array(z.enum(["admin", "support"])),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Réponse de GET /v1/public/experiences/:slug (destinataire, sans compte). */
export const publicExperienceResponseSchema = z.object({
  rendererKey: z.string().regex(/^[a-z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+$/),
  payload: z.looseObject({
    schema: z.literal(1),
    rendererKey: z.string(),
    fields: z.record(z.string(), z.unknown()),
    disabledSections: z.array(z.string()),
    salt: z.string(),
  }),
});
export type PublicExperienceResponse = z.infer<typeof publicExperienceResponseSchema>;

/** Format d'un lien d'expérience : 10 à 32 caractères alphanumériques (aléatoires). */
export const experienceSlugSchema = z.string().regex(/^[A-Za-z0-9]{10,32}$/);

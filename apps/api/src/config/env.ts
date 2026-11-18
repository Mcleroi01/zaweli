import { z } from "zod";

/**
 * Variables d'environnement de l'API, validées AU DÉMARRAGE :
 * l'API refuse de démarrer si une valeur manque ou est invalide.
 *
 * Aucun secret Supabase n'est nécessaire pour vérifier les jetons : la
 * vérification se fait avec les clés PUBLIQUES (JWKS) de Supabase Auth.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_VERSION: z.string().min(1).default("0.0.0"),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "URL PostgreSQL attendue"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    SUPABASE_URL: z.url(),
    /** Adresse publique du site : sert à construire les liens partagés (/g/<lien>). */
    PUBLIC_WEB_URL: z.url().default("https://zaweli.store"),
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    // Moindre privilège : en production, jamais le super-utilisateur.
    const user = decodeURIComponent(new URL(env.DATABASE_URL).username);
    if (user === "postgres" || user === "supabase_admin") {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "en production, l'API doit utiliser son rôle dédié" });
    }
    if (env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "obligatoire en production" });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol("ENV");

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"} : ${i.message}`);
    throw new Error(`Configuration invalide :\n${lines.join("\n")}`);
  }
  return parsed.data;
}

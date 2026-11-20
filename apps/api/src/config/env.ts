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
    /**
     * Clé secrète du projet Supabase (service role), côté serveur seulement :
     * adresses d'envoi signées et traitement des photos (Storage). Sans elle,
     * l'envoi de photos est indisponible ; le reste de l'API fonctionne.
     */
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    /** Adresse publique du site : sert à construire les liens partagés (/g/<lien>). */
    PUBLIC_WEB_URL: z.url().default("https://zaweli.store"),
    /**
     * En-tête posé par le CDN avec le pays du visiteur (ISO 3166-1 alpha-2),
     * utilisé pour PRÉ-REMPLIR le pays d'un compte qui n'en a pas déclaré.
     * Cloudflare : cf-ipcountry. Vide : aucune détection.
     */
    GEO_COUNTRY_HEADER: z
      .string()
      .regex(/^[a-z0-9-]*$/i, "nom d'en-tête HTTP attendu")
      .default("cf-ipcountry")
      .transform((s) => s.toLowerCase()),
    /**
     * Mandataires de confiance devant l'API (Express « trust proxy »), pour lire
     * la vraie adresse IP du visiteur dans X-Forwarded-For : limites de débit,
     * signalements. Vide : aucun (connexion directe). Un nombre = nombre de
     * mandataires (Hostinger : CDN + serveur web = 2). Ou une liste d'adresses.
     * Trop haut, un visiteur peut se faire passer pour un autre ; trop bas, tous
     * les visiteurs partagent la même limite.
     */
    TRUST_PROXY: z
      .string()
      .trim()
      .default("")
      .transform((s): boolean | number | string => (s === "" || s === "false" ? false : s === "true" ? true : /^\d+$/.test(s) ? Number(s) : s)),
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
    /**
     * Mobile money (MbiyoPay, docs/12). Sans clé, le paiement est simplement
     * indisponible (le reste de l'API fonctionne). La clé « Test » du tableau
     * de bord MbiyoPay donne la sandbox, la clé « Live » les vrais paiements :
     * MBIYOPAY_MODE doit dire laquelle est utilisée (affiché aux clients).
     */
    MBIYOPAY_API_KEY: z.string().trim().min(10).optional(),
    MBIYOPAY_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
    MBIYOPAY_BASE_URL: z.url({ protocol: /^https?$/ }).default("https://dashboard.mbiyo.africa/api/v1"),
    /** Secret des webhooks, saisi dans Paramètres → Webhooks du tableau de bord MbiyoPay. */
    MBIYOPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
    /** Adresse publique de l'API : MbiyoPay y envoie ses webhooks (obligatoire pour les envois d'argent). */
    PUBLIC_API_URL: z.url().optional(),
    /** Musique (Audius, docs/12 §6) : la recherche publique marche sans clé ; une clé d'application est facultative. */
    AUDIUS_API_URL: z.url({ protocol: /^https?$/ }).default("https://api.audius.co/v1"),
    AUDIUS_API_KEY: z.string().trim().min(8).optional(),
    /** E-mails transactionnels (paiement confirmé, argent reçu). Ex. smtps://user:motdepasse@smtp.exemple.com:465. Vide : journal seulement. */
    /** Aide à l'écriture (OpenRouter). Sans clé ou sans modèle : fonction indisponible. Le modèle est un identifiant OpenRouter. */
    OPENROUTER_API_KEY: z.string().trim().min(10).optional(),
    OPENROUTER_MODEL: z.string().trim().regex(/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i, "identifiant OpenRouter « fournisseur/modèle » attendu").optional(),
    SMTP_URL: z.string().regex(/^smtps?:\/\//, "URL smtp:// ou smtps:// attendue").optional(),
    MAIL_FROM: z.string().min(3).default("Zaweli <bonjour@zaweli.store>"),
    /** Revérification des paiements en attente, en secondes (0 : désactivée). */
    PAYMENTS_RECONCILE_SECONDS: z.coerce.number().int().min(0).max(3600).default(120),
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
    if (env.MBIYOPAY_API_KEY && !env.MBIYOPAY_WEBHOOK_SECRET) {
      ctx.addIssue({ code: "custom", path: ["MBIYOPAY_WEBHOOK_SECRET"], message: "obligatoire en production dès qu'une clé MbiyoPay est fournie" });
    }
    if (env.MBIYOPAY_API_KEY && !env.PUBLIC_API_URL) {
      ctx.addIssue({ code: "custom", path: ["PUBLIC_API_URL"], message: "obligatoire en production dès qu'une clé MbiyoPay est fournie (webhooks)" });
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

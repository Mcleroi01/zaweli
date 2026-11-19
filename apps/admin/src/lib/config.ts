/**
 * Configuration publique de l'administration (variables NEXT_PUBLIC_*, lues au build).
 *
 *  - NEXT_PUBLIC_API_URL : adresse de l'API (ex. https://api.zaweli.store). Le domaine
 *    admin.zaweli.store doit figurer dans CORS_ORIGINS de l'API.
 *  - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY : connexion Supabase Auth
 *    (clé publique ; le rôle admin est vérifié par l'API, en base, à chaque requête).
 *  - NEXT_PUBLIC_ADMIN_DEMO=1 : données de démonstration GÉNÉRÉES, pour le développement.
 *    Jamais en production : la condition sur NODE_ENV est évaluée au build et retire
 *    le mode démo du code livré.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const DEMO_MODE = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ADMIN_DEMO === "1";

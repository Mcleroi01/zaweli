import { z } from "zod";

/**
 * Langues prises en charge par ZAWELI (interface, e-mails, messages d'erreur,
 * formulations des cadeaux). Le français reste la langue par défaut.
 * Ajouter une langue : l'ajouter ici, puis compléter chaque dictionnaire
 * typé `Record<Locale, …>` (le compilateur signale ceux qui manquent).
 */
export const LOCALES = ["fr", "en"] as const;
export const DEFAULT_LOCALE = "fr";

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** Balise BCP 47 utilisée par Intl (dates, nombres, devises). */
export const INTL_TAG: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * Choisit la langue d'une requête : valeur explicite (paramètre `lang`,
 * préférence du profil), sinon l'en-tête Accept-Language (pondérations q
 * respectées), sinon le français.
 */
export function resolveLocale(explicit?: string | null, acceptLanguage?: string | null): Locale {
  if (explicit) {
    const base = explicit.trim().toLowerCase().slice(0, 2);
    if (isLocale(base)) return base;
  }
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(",")
      .map((part, index) => {
        const [tag = "", ...params] = part.trim().split(";");
        const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
        return { base: tag.trim().toLowerCase().slice(0, 2), q: q ? Number(q.slice(2)) || 0 : 1, index };
      })
      .filter((x) => x.q > 0)
      .sort((a, b) => b.q - a.q || a.index - b.index);
    for (const { base } of ranked) if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Textes traduits stockés en base (colonne `translations` en JSON) :
 * { "en": { "name": "Birthday" } }. La valeur de la colonne d'origine
 * (rédigée en français) sert de repli.
 */
export const translationsSchema = z.partialRecord(localeSchema, z.record(z.string(), z.string().max(2000)));
export type Translations = z.infer<typeof translationsSchema>;

export function translate(translations: unknown, locale: Locale, key: string, fallback: string): string;
export function translate(translations: unknown, locale: Locale, key: string, fallback: string | null): string | null;
export function translate(translations: unknown, locale: Locale, key: string, fallback: string | null) {
  if (locale === DEFAULT_LOCALE || !translations || typeof translations !== "object") return fallback;
  const value = (translations as Record<string, Record<string, unknown> | undefined>)[locale]?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

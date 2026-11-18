import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@zaweli/shared-types";

/**
 * Adresses du site par langue. Le français (langue par défaut) est servi à la
 * racine (/modeles) ; les autres langues sous leur préfixe (/en/modeles).
 * Les chemins gardent les mêmes segments dans chaque langue : changer de
 * langue revient à ajouter ou retirer le préfixe.
 */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === "/") return `/${locale}`;
  // « /#parcours » devient « /en#parcours » (l'accueil anglais est /en).
  if (path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** Langue et chemin « neutre » d'une adresse : /en/tarifs → { locale: "en", path: "/tarifs" }. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  if (first !== DEFAULT_LOCALE && isLocale(first)) return { locale: first, path: `/${rest.join("/")}` };
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/** Canonique de la page dans sa langue, et ses équivalents (hreflang) dans toutes les langues. */
export function alternatesFor(locale: Locale, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
      "x-default": localePath(DEFAULT_LOCALE, path),
    },
  };
}

/** Balise Open Graph (og:locale) de chaque langue. */
export const OG_LOCALE: Record<Locale, string> = { fr: "fr_FR", en: "en_GB" };

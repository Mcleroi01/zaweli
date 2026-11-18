import { LOCALES, type Locale } from "@zaweli/shared-types";
import { en } from "./en";
import { fr } from "./fr";

export type { StepId, TemplateCopy, TemplateSlug } from "./fr";

/** Forme commune à toutes les langues, déduite du dictionnaire de référence (français). */
export type Dictionary = typeof fr;

/** Une langue ajoutée à LOCALES sans son dictionnaire fait échouer la compilation. */
const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

/** Nom de chaque version, écrit dans sa propre langue (sélecteur de langue). */
export const LANGUAGE_NAMES = Object.fromEntries(LOCALES.map((l) => [l, DICTIONARIES[l].language.switchTo])) as Record<Locale, string>;

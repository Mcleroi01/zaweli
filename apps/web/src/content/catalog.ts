import type { Locale } from "@zaweli/shared-types";
import { coffretV1 } from "@zaweli/template-coffret";
import { eclatV1 } from "@zaweli/template-eclat";
import type { TemplateManifest } from "@zaweli/template-engine/schema";
import { getDictionary, type StepId, type TemplateSlug } from "@/i18n/dictionaries";

/**
 * Catalogue public. Le texte éditorial vient des dictionnaires (une version
 * par langue) ; les caractéristiques (photos, étapes, sections facultatives,
 * cadeaux) sont CALCULÉES à partir du manifeste : le site ne peut pas
 * promettre ce que le modèle ne permet pas.
 */
export type Screen = { src: string; alt: string };

export type CatalogEntry = {
  slug: TemplateSlug;
  manifest: TemplateManifest;
  name: string;
  tagline: string;
  occasion: string;
  pitch: string;
  /** Teinte d'accent de la fiche (couleur du template, pas du SaaS). */
  tone: { bg: string; ink: string; accent: string };
  cover: Screen;
  screens: Screen[];
  highlights: ReadonlyArray<{ title: string; text: string }>;
};

/** Partie commune à toutes les langues. Les écrans suivent l'ordre de `screenAlts` des dictionnaires. */
const TEMPLATES: ReadonlyArray<{ slug: TemplateSlug; manifest: TemplateManifest; tone: CatalogEntry["tone"]; cover: string; screens: readonly string[] }> = [
  {
    slug: "coffret",
    manifest: coffretV1,
    tone: { bg: "#3a0710", ink: "#f6efe3", accent: "#d9ac55" },
    cover: "/showcase/coffret-seal.webp",
    screens: [
      "/showcase/coffret-seal.webp",
      "/showcase/coffret-jewel.webp",
      "/showcase/coffret-riddle.webp",
      "/showcase/coffret-gifts.webp",
      "/showcase/coffret-party.webp",
      "/showcase/coffret-letter.webp",
    ],
  },
  {
    slug: "eclat",
    manifest: eclatV1,
    tone: { bg: "#140709", ink: "#f4ece1", accent: "#dcc08c" },
    cover: "/showcase/eclat-hero.webp",
    screens: [
      "/showcase/eclat-intro.webp",
      "/showcase/eclat-hero.webp",
      "/showcase/eclat-achievement.webp",
      "/showcase/eclat-timeline.webp",
      "/showcase/eclat-letter.webp",
      "/showcase/eclat-final.webp",
    ],
  },
];

export const TEMPLATE_SLUGS = TEMPLATES.map((t) => t.slug);

export function getCatalog(locale: Locale): CatalogEntry[] {
  const dict = getDictionary(locale);
  return TEMPLATES.map((t) => {
    const copy = dict.catalog[t.slug];
    return {
      slug: t.slug,
      manifest: t.manifest,
      tone: t.tone,
      name: copy.name,
      tagline: copy.tagline,
      occasion: copy.occasion,
      pitch: copy.pitch,
      cover: { src: t.cover, alt: copy.coverAlt },
      screens: t.screens.map((src, i) => ({ src, alt: copy.screenAlts[i] ?? "" })),
      highlights: copy.highlights,
    };
  });
}

export const findTemplate = (locale: Locale, slug: string) => getCatalog(locale).find((t) => t.slug === slug);

const isStepId = (id: string, titles: Record<StepId, string>): id is StepId => id in titles;

/** Caractéristiques lues dans le manifeste, formulées dans la langue demandée. */
export function specs(manifest: TemplateManifest, locale: Locale) {
  const dict = getDictionary(locale);
  const fields = Object.values(manifest.fields);
  const gift = fields.find((f) => f.kind === "giftList");
  const riddles = fields.find((f) => f.kind === "riddleList");
  return {
    // Titre traduit de l'étape ; à défaut (nouvelle étape non traduite), celui du manifeste.
    steps: manifest.steps.map((s) => (isStepId(s.id, dict.stepTitles) ? dict.stepTitles[s.id] : s.title)),
    maxPhotos: manifest.media.maxPhotos,
    optionalSections: manifest.sections.filter((s) => s.optional).length,
    riddles: riddles && riddles.kind === "riddleList" ? dict.specs.range(riddles.min, riddles.max) : null,
    gifts:
      gift && gift.kind === "giftList"
        ? { range: dict.specs.range(gift.min, gift.max), types: gift.types.map((t) => dict.giftLabels[t] ?? t) }
        : null,
    aiFields: fields.filter((f) => "aiAssist" in f && f.aiAssist).length,
    version: manifest.version,
  };
}

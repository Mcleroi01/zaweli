import { LOCALES, type Locale } from "@zaweli/shared-types";
import { getCatalog } from "@/content/catalog";
import { SITE_URL } from "@/content/site";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath } from "@/i18n/routing";

const LABELS: Record<Locale, { language: string; pages: string; templates: string; demo: string }> = {
  fr: { language: "Français", pages: "Pages", templates: "Modèles", demo: "démonstration" },
  en: { language: "English", pages: "Pages", templates: "Templates", demo: "demo" },
};

const url = (locale: Locale, path: string) => `${SITE_URL}${localePath(locale, path)}`;

function section(locale: Locale): string[] {
  const d = getDictionary(locale);
  const l = LABELS[locale];
  return [
    `## ${l.language}`,
    "",
    d.meta.description,
    "",
    `### ${l.pages}`,
    "",
    `- [${d.meta.siteTitle}](${url(locale, "/")})`,
    `- [${d.models.title}](${url(locale, "/modeles")}): ${d.models.description}`,
    `- [${d.pricing.title}](${url(locale, "/tarifs")}): ${d.pricing.description}`,
    `- [${d.about.title}](${url(locale, "/a-propos")}): ${d.about.description}`,
    `- [${d.questions.title}](${url(locale, "/questions")}): ${d.questions.description}`,
    `- [${d.contact.title}](${url(locale, "/contact")}): ${d.contact.description}`,
    "",
    `### ${l.templates}`,
    "",
    ...getCatalog(locale).map(
      (t) => `- [${t.name}](${url(locale, `/modeles/${t.slug}`)}) (${t.occasion}, [${l.demo}](${url(locale, `/modeles/${t.slug}/demo`)})): ${t.tagline} ${t.pitch}`,
    ),
    "",
  ];
}

/**
 * llms.txt (https://llmstxt.org) : résumé du site public pour les assistants,
 * avec ses pages clés, en français et en anglais. Les expériences offertes
 * (/g/…) sont privées et n'y figurent jamais.
 */
/** Prérendu au build (cacheComponents) : il ne lit rien de la requête. */
export function GET() {
  const body = [
    "# Zaweli",
    "",
    `> ${getDictionary("fr").meta.description}`,
    "",
    ...LOCALES.flatMap(section),
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

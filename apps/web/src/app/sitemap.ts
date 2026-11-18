import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES } from "@zaweli/shared-types";
import { TEMPLATE_SLUGS } from "@/content/catalog";
import { SITE_URL } from "@/content/site";
import { localePath } from "@/i18n/routing";

/**
 * Pages publiques à proposer aux moteurs de recherche (jamais les expériences privées /g/…),
 * dans chaque langue, avec leurs équivalents (hreflang).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<[path: string, priority: number, changeFrequency: "weekly" | "monthly"]> = [
    ["/", 1, "weekly"],
    ["/modeles", 0.9, "weekly"],
    ...TEMPLATE_SLUGS.flatMap((slug): Array<[string, number, "monthly"]> => [
      [`/modeles/${slug}`, 0.8, "monthly"],
      [`/modeles/${slug}/demo`, 0.7, "monthly"],
    ]),
    ["/tarifs", 0.7, "monthly"],
    ["/a-propos", 0.6, "monthly"],
    ["/questions", 0.6, "monthly"],
    ["/contact", 0.5, "monthly"],
  ];
  const url = (locale: (typeof LOCALES)[number], path: string) => `${SITE_URL}${localePath(locale, path)}`;
  return pages.flatMap(([path, priority, changeFrequency]) =>
    LOCALES.map((locale) => ({
      url: url(locale, path),
      changeFrequency,
      // La version par défaut garde sa priorité ; les traductions passent juste derrière.
      priority: locale === DEFAULT_LOCALE ? priority : Math.round(priority * 90) / 100,
      alternates: {
        languages: {
          ...Object.fromEntries(LOCALES.map((l) => [l, url(l, path)])),
          "x-default": url(DEFAULT_LOCALE, path),
        },
      },
    })),
  );
}

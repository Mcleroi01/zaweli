import type { MetadataRoute } from "next";
import { catalog } from "@/content/catalog";
import { SITE_URL } from "@/content/site";

/** Pages publiques à proposer aux moteurs de recherche (jamais les expériences privées /g/…). */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" = "monthly") => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "weekly"),
    page("/modeles", 0.9, "weekly"),
    ...catalog.flatMap((t) => [page(`/modeles/${t.slug}`, 0.8), page(`/modeles/${t.slug}/demo`, 0.7)]),
    page("/tarifs", 0.7),
    page("/a-propos", 0.6),
    page("/questions", 0.6),
    page("/contact", 0.5),
  ];
}

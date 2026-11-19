import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

/** Le site public est explorable ; les expériences privées et la page technique ne le sont pas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/g/", "/status", "/espace", "/en/espace", "/verifier", "/en/verifier", "/mot-de-passe", "/en/mot-de-passe"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

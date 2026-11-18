import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

/** Le site public est explorable ; les expériences privées et la page technique ne le sont pas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/g/", "/status"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import type { MetadataRoute } from "next";

/** Export statique : robots.txt est écrit au build. */
export const dynamic = "force-static";

/** L'administration n'est jamais explorée. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

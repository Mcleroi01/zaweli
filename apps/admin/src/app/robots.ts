import type { MetadataRoute } from "next";

/** L'administration n'est jamais explorée. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

import type { NextConfig } from "next";

/**
 * Espace d'administration, déployé à part sur admin.zaweli.store.
 * Rien n'y est public ni indexable ; aucune page n'est mise en cache.
 * Les données viennent de l'API (/v1/admin/…), qui vérifie le rôle en base.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@zaweli/ui"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

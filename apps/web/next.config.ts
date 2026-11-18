import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Le design system est livré en sources TypeScript.
  transpilePackages: ["@zaweli/ui"],
  poweredByHeader: false,
  // Une mise en page racine par langue (<html lang> exact) : la 404 des adresses inconnues
  // est donc définie à part, dans app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  // Les visuels sont déjà des WebP légers (16 à 47 Ko). L'optimiseur à la demande
  // saturait l'hébergement mutualisé (réponses 503) : on sert les fichiers tels quels.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

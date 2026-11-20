import type { NextConfig } from "next";

/**
 * Espace d'administration, servi sur admin.zaweli.store.
 *
 * EXPORT STATIQUE : toutes les pages sont rendues dans le navigateur et les
 * données viennent de l'API (/v1/admin/…), qui vérifie le rôle en base. Le
 * build produit `out/`, un simple dossier de fichiers à déposer dans celui du
 * sous-domaine (Hostinger : public_html/admin). Aucun serveur Node n'est requis.
 *
 * Les en-têtes (sécurité, aucun cache, aucune indexation) ne peuvent pas venir
 * de Next.js en export : ils sont posés par `public/.htaccess`, copié dans `out/`.
 */
const nextConfig: NextConfig = {
  output: "export",
  // /carte/ → carte/index.html : chaque page est un fichier que le serveur web trouve seul.
  trailingSlash: true,
  transpilePackages: ["@zaweli/ui"],
  poweredByHeader: false,
};

export default nextConfig;

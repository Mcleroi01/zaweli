// Point d'entrée de production pour les hébergeurs qui lancent `node <fichier>`
// (Hostinger : champ « Entry file » = apps/web/server.mjs).
// Prérequis : `pnpm exec turbo run build --filter=@zaweli/web` a produit apps/web/.next.
import { createServer } from "node:http";
import next from "next";

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: import.meta.dirname });
const handle = app.getRequestHandler();

/**
 * Cache des pages : Next.js envoie `s-maxage=31536000` pour les pages prérendues,
 * ce qui autorise le CDN de l'hébergeur à garder une page UN AN, même après une
 * mise à jour. On impose une revalidation à chaque visite (réponse 304 si rien n'a
 * changé, donc très légère).
 * Exception : /_next/static, dont les noms de fichiers changent à chaque build ;
 * leur cache d'un an (« immutable ») est sûr et reste tel quel.
 */
const REVALIDATE = "public, max-age=0, must-revalidate";
const IMMUTABLE_PREFIX = "/_next/static/";

/** Une consigne déjà plus stricte (private, no-store : pages privées, erreurs) est conservée. */
const policy = (value) => (/no-store|private/i.test(String(value)) ? value : REVALIDATE);

function forceRevalidation(res) {
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) => setHeader(name, String(name).toLowerCase() === "cache-control" ? policy(value) : value);
  const writeHead = res.writeHead.bind(res);
  res.writeHead = (status, ...rest) => {
    const headers = rest.find((h) => h && typeof h === "object");
    if (headers && !Array.isArray(headers)) {
      for (const key of Object.keys(headers)) if (key.toLowerCase() === "cache-control") headers[key] = policy(headers[key]);
    }
    if (!res.hasHeader("cache-control")) setHeader("Cache-Control", REVALIDATE);
    return writeHead(status, ...rest);
  };
}

await app.prepare();

createServer((req, res) => {
  if (!req.url?.startsWith(IMMUTABLE_PREFIX)) forceRevalidation(res);
  return handle(req, res);
}).listen(port, () => {
  console.log(`[zaweli-web] prêt sur le port ${port}`);
});

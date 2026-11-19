// Point d'entrée de production de l'administration (Hostinger : seconde application
// Node.js, sous-domaine admin.zaweli.store, « Entry file » = apps/admin/server.mjs).
// Prérequis : `pnpm exec turbo run build --filter=@zaweli/admin` a produit apps/admin/.next.
import { createServer } from "node:http";
import next from "next";

const port = process.env.PORT || 3001;
const app = next({ dev: false, dir: import.meta.dirname });
const handle = app.getRequestHandler();

/**
 * Aucune page de l'administration ne doit rester dans un cache (CDN, navigateur
 * partagé) : `private, no-store` partout, sauf /_next/static dont les noms de
 * fichiers changent à chaque build (cache « immutable » sûr, sans donnée).
 */
const NO_STORE = "private, no-store";
const IMMUTABLE_PREFIX = "/_next/static/";

function forceNoStore(res) {
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) => setHeader(name, String(name).toLowerCase() === "cache-control" ? NO_STORE : value);
  const writeHead = res.writeHead.bind(res);
  res.writeHead = (status, ...rest) => {
    const headers = rest.find((h) => h && typeof h === "object");
    if (headers && !Array.isArray(headers)) {
      for (const key of Object.keys(headers)) if (key.toLowerCase() === "cache-control") headers[key] = NO_STORE;
    }
    if (!res.hasHeader("cache-control")) setHeader("Cache-Control", NO_STORE);
    return writeHead(status, ...rest);
  };
}

await app.prepare();

createServer((req, res) => {
  if (!req.url?.startsWith(IMMUTABLE_PREFIX)) forceNoStore(res);
  return handle(req, res);
}).listen(port, () => {
  console.log(`[zaweli-admin] prêt sur le port ${port}`);
});

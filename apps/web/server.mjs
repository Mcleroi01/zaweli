// Point d'entrée de production pour les hébergeurs qui lancent `node <fichier>`
// (Hostinger : champ « Entry file » = apps/web/server.mjs).
// Prérequis : `pnpm exec turbo run build --filter=@zaweli/web --filter=@zaweli/api`
// a produit apps/web/.next (et apps/api/dist pour l'API).
//
// UNE SEULE application Node.js (Hostinger n'en accepte qu'une) : ce serveur sert
// le site ET l'API. Les adresses /v1/… vont à l'API NestJS, tout le reste à Next.js.
// L'API n'est montée que si DATABASE_URL est réglée ; si elle ne démarre pas
// (configuration invalide), le site reste en ligne et /v1 répond 503.
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import next from "next";

// Sans NODE_ENV, l'API se croirait en développement (contrôles de production sautés).
process.env.NODE_ENV ||= "production";

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

/** API NestJS, construite dans apps/api/dist, montée sous /v1. */
async function loadApi() {
  const entry = new URL("../api/dist/create-app.js", import.meta.url);
  if (!process.env.DATABASE_URL) {
    console.log("[zaweli-web] API non montée : DATABASE_URL absente.");
    return null;
  }
  if (!existsSync(entry)) {
    console.error("[zaweli-web] API non montée : apps/api/dist manquant (build sans --filter=@zaweli/api ?).");
    return null;
  }
  try {
    const { createApp } = await import(entry.href);
    const api = await createApp();
    await api.init();
    console.log("[zaweli-web] API montée sous /v1.");
    return api.getHttpAdapter().getInstance();
  } catch (error) {
    console.error("[zaweli-web] API non montée :", error instanceof Error ? error.message : error);
    return null;
  }
}

const api = await loadApi();
const isApi = (url = "") => url === "/v1" || url.startsWith("/v1/") || url.startsWith("/v1?");

function apiUnavailable(res) {
  res.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "API indisponible." } }));
}

createServer((req, res) => {
  if (isApi(req.url)) return api ? api(req, res) : apiUnavailable(res);
  if (!req.url?.startsWith(IMMUTABLE_PREFIX)) forceRevalidation(res);
  return handle(req, res);
}).listen(port, () => {
  console.log(`[zaweli-web] prêt sur le port ${port}`);
});

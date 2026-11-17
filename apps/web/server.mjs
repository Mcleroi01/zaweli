// Point d'entrée de production pour les hébergeurs qui lancent `node <fichier>`
// (Hostinger : champ « Entry file » = apps/web/server.mjs).
// Prérequis : `pnpm exec turbo run build --filter=@zaweli/web` a produit apps/web/.next.
import { createServer } from "node:http";
import next from "next";

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: import.meta.dirname });
const handle = app.getRequestHandler();

await app.prepare();

createServer((req, res) => handle(req, res)).listen(port, () => {
  console.log(`[zaweli-web] prêt sur le port ${port}`);
});

// Point d'entrée de production pour les hébergeurs qui lancent `node <fichier>`
// (Hostinger : champ « Entry file » = apps/api/server.mjs).
// Prérequis : `pnpm exec turbo run build --filter=@zaweli/api` a produit apps/api/dist.
//
// L'hébergeur ne pose pas toujours NODE_ENV : sans lui, l'API se croirait en
// développement (contrôles de production sautés, journaux non structurés).
process.env.NODE_ENV ||= "production";

await import("./dist/main.js");

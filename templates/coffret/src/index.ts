// Point d'entrée sans React : utilisable par l'API et les scripts.
export { coffretV1, type CoffretManifest } from "./manifest.js";
export { coffretDemoPayload } from "./demo.js";

import { coffretV1 } from "./manifest.js";
/** Toutes les versions de manifeste de ce template (lues par `pnpm templates:sync`). */
export const manifests = [coffretV1];

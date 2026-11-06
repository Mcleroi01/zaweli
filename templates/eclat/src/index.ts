// Point d'entrée sans React : utilisable par l'API et les scripts.
import { eclatV1 } from "./manifest.js";

export { eclatV1, type EclatManifest } from "./manifest.js";
export { eclatDemoPayload } from "./demo.js";

/** Toutes les versions de manifeste de ce template (lues par `pnpm templates:sync`). */
export const manifests = [eclatV1];

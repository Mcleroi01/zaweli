import { SITE_URL } from "@/content/site";

/** Jamais explorés : expériences privées, espace client, pages techniques. */
const DISALLOW = ["/g/", "/status", "/espace", "/en/espace", "/verifier", "/en/verifier", "/mot-de-passe", "/en/mot-de-passe"];

/**
 * Usage du contenu par les robots (https://contentsignals.org) :
 *  - search=yes   : apparaître dans les moteurs de recherche ;
 *  - ai-input=yes : être cité dans les réponses des assistants (avec lien) ;
 *  - ai-train=no  : ne pas servir à entraîner des modèles.
 */
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

/**
 * robots.txt écrit à la main plutôt que par robots.ts : Next.js ne sait pas
 * produire la ligne Content-Signal.
 */
/** Prérendu au build (cacheComponents) : il ne lit rien de la requête. */
export function GET() {
  const body = [
    "User-Agent: *",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    "Allow: /",
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Host: ${SITE_URL}`,
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

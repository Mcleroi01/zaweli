/**
 * Empreinte SHA-256 d'un manifeste, calculée sur un JSON CANONIQUE
 * (clés triées) : deux manifestes identiques donnent la même empreinte quel
 * que soit l'ordre des clés. Utilise Web Crypto (Node ≥ 20 et navigateurs).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export async function manifestHash(manifest: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(manifest));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

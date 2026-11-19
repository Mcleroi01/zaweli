import { isCountryCode } from "@zaweli/shared-types";
import type { Request } from "express";

/**
 * Pays du visiteur d'après l'en-tête du CDN (configurable : GEO_COUNTRY_HEADER).
 * Les valeurs non géographiques des CDN (« XX » inconnu, « T1 » Tor, « EU »…)
 * ne correspondent à aucun code ISO et sont ignorées.
 */
export function requestCountry(req: Pick<Request, "headers">, header: string): string | null {
  if (!header) return null;
  const raw = req.headers[header];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();
  return value && isCountryCode(value) ? value : null;
}

import { z } from "zod";

/**
 * Pays (ISO 3166-1 alpha-2) et continents, pour les statistiques mondiales
 * de l'administration. Les noms ne sont pas stockés : ils viennent de
 * `Intl.DisplayNames`, dans la langue de l'interface.
 *
 * Découpage en continents : géoscheme de l'ONU (M49), à deux choix près,
 * habituels pour un produit grand public : l'Amérique centrale et les
 * Caraïbes sont rattachées à l'Amérique du Nord, et Chypre à l'Europe.
 * Liste vérifiée contre i18n-iso-countries (même ensemble de codes).
 */
export const CONTINENTS = ["africa", "europe", "asia", "north_america", "south_america", "oceania", "antarctica"] as const;
export const continentSchema = z.enum(CONTINENTS);
export type Continent = z.infer<typeof continentSchema>;

const BY_CONTINENT: Record<Continent, string> = {
  africa:
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH RE YT SH IO",
  europe:
    "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA FO GI GG IM JE AX SJ XK",
  asia: "AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  north_america:
    "AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US AI AW BM BQ VG KY CW GL GP MQ MS PR BL MF PM SX TC VI UM",
  south_america: "AR BO BR CL CO EC GY PY PE SR UY VE FK GF GS",
  oceania: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU AS CK PF GU NC NU NF MP PN TK WF CC CX HM",
  antarctica: "AQ BV TF",
};

/** Continent de chaque pays : les 249 codes ISO 3166-1, plus XK (Kosovo, code utilisateur envoyé par les CDN). */
export const COUNTRY_CONTINENT: Readonly<Record<string, Continent>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(BY_CONTINENT) as Array<[Continent, string]>).flatMap(([continent, codes]) =>
      codes.split(" ").map((code) => [code, continent] as const),
    ),
  ),
);

export const COUNTRY_CODES: readonly string[] = Object.freeze(Object.keys(COUNTRY_CONTINENT).sort());

export const isCountryCode = (value: unknown): value is string => typeof value === "string" && value in COUNTRY_CONTINENT;

/** Code pays ISO 3166-1 alpha-2 connu (en majuscules ; « cd » est accepté et normalisé). */
export const countryCodeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine(isCountryCode, "code pays ISO 3166-1 alpha-2 inconnu");

export const continentOf = (code: string | null | undefined): Continent | null =>
  code ? (COUNTRY_CONTINENT[code.toUpperCase()] ?? null) : null;

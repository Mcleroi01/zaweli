import type { Continent } from "@zaweli/shared-types";

/** Formats de l'administration (français). Les noms de pays viennent d'Intl, jamais d'une liste recopiée. */
const LOCALE = "fr-FR";

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 });
const regions = new Intl.DisplayNames([LOCALE], { type: "region", fallback: "code" });

export const formatInt = (n: number) => integer.format(n);
export const formatCompact = (n: number) => (Math.abs(n) < 10_000 ? integer.format(n) : compact.format(n));
export const formatPercent = (ratio: number) => percent.format(ratio);

/** Montant exact (chaîne décimale de l'API) dans sa devise. */
export function formatMoney(amount: string | number, currency: string, options: { compact?: boolean } = {}) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const big = options.compact && Math.abs(value) >= 10_000;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: big ? "compact" : "standard",
    maximumFractionDigits: big ? 1 : value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(value);
}

export function countryName(code: string) {
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

export const CONTINENT_LABELS: Record<Continent, string> = {
  africa: "Afrique",
  europe: "Europe",
  asia: "Asie",
  north_america: "Amérique du Nord",
  south_america: "Amérique du Sud",
  oceania: "Océanie",
  antarctica: "Antarctique",
};

const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "2-digit", timeZone: "UTC" });

/** Dates « locales » AAAA-MM-JJ de l'API : affichées telles quelles (pas de décalage de fuseau). */
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
export const formatDay = (date: string) => day.format(utc(date));
export const formatDayLong = (date: string) => dayLong.format(utc(date));
export const formatMonth = (date: string) => monthYear.format(utc(date.length === 7 ? `${date}-01` : date));
export const formatMonthShort = (date: string) => monthShort.format(utc(date));

export function formatDateTime(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "medium", timeZone }).format(new Date(iso));
}

/** Variation relative signée, ou null si la période précédente est vide. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

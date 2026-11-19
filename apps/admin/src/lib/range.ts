import type { InsightsRange } from "@zaweli/shared-types";

/** Périodes proposées (lignes de préréglages, puis personnalisée). */
export const PRESETS = [
  { id: "7d", label: "7 derniers jours" },
  { id: "30d", label: "30 derniers jours" },
  { id: "90d", label: "90 derniers jours" },
  { id: "mtd", label: "Mois en cours" },
  { id: "12m", label: "12 derniers mois" },
  { id: "custom", label: "Personnalisée" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

export type Period = { preset: PresetId; from: string; to: string };

/** Fuseau du navigateur : « par jour » veut dire « par jour chez l'équipe qui regarde ». */
export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** Aujourd'hui, AAAA-MM-JJ, dans un fuseau donné. */
export function today(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const DAY = 86_400_000;
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

export function presetRange(preset: Exclude<PresetId, "custom">, tz: string): { from: string; to: string } {
  const to = today(tz);
  switch (preset) {
    case "7d":
      return { from: addDays(to, -6), to };
    case "30d":
      return { from: addDays(to, -29), to };
    case "90d":
      return { from: addDays(to, -89), to };
    case "mtd":
      return { from: `${to.slice(0, 7)}-01`, to };
    case "12m":
      return { from: addDays(to, -364), to };
  }
}

export const toRange = (period: Period, tz: string): InsightsRange => ({ from: period.from, to: period.to, tz });

/** Granularité adaptée à la longueur de la période (jamais plus de ~90 barres). */
export const intervalFor = (range: { from: string; to: string }) => {
  const days = daysBetween(range.from, range.to) + 1;
  return days <= 92 ? ("day" as const) : days <= 400 ? ("week" as const) : ("month" as const);
};

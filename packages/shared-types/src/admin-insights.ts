/**
 * Contrats des statistiques d'administration (/v1/admin/insights, /v1/admin/audit,
 * /v1/admin/exchange-rates), partagés entre l'API et l'espace d'administration.
 *
 * Montants : toujours des chaînes décimales (aucune perte de précision).
 * Conversion : vers la devise de référence, avec les taux SAISIS par
 * l'administration et datés. Une devise sans taux n'est jamais convertie au
 * hasard : elle est exclue du total et listée dans `missingRates`.
 */
import { z } from "zod";
import { type Continent } from "./geo.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date AAAA-MM-JJ attendue");
const currency = z.string().regex(/^[A-Z]{3}$/, "devise ISO 4217 attendue");

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Fuseau IANA dans lequel les jours sont découpés (« par jour » dépend du pays de l'équipe). */
export const timeZoneSchema = z.string().min(1).max(64).refine(isTimeZone, "fuseau horaire inconnu").default("UTC");

/** Période d'analyse, bornes incluses, au plus 400 jours. Paramètres de requête : les inconnus (?lang=…) sont ignorés. */
export const insightsRangeSchema = z
  .object({ from: isoDate, to: isoDate, tz: timeZoneSchema })
  .refine((r) => r.from <= r.to, { message: "« from » doit précéder « to »", path: ["from"] })
  .refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 400, { message: "400 jours au plus", path: ["to"] });
export type InsightsRange = z.infer<typeof insightsRangeSchema>;

export const INSIGHTS_INTERVALS = ["day", "week", "month"] as const;
export const insightsTimeseriesSchema = z
  .object({ from: isoDate, to: isoDate, tz: timeZoneSchema, interval: z.enum(INSIGHTS_INTERVALS).default("day") })
  .refine((r) => r.from <= r.to, { message: "« from » doit précéder « to »", path: ["from"] })
  .refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 400, { message: "400 jours au plus", path: ["to"] });
export type InsightsTimeseriesQuery = z.infer<typeof insightsTimeseriesSchema>;

export const insightsCalendarSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mois AAAA-MM attendu"),
  tz: timeZoneSchema,
});
export type InsightsCalendarQuery = z.infer<typeof insightsCalendarSchema>;

export type Money = { currency: string; amount: string };

/** Total converti dans la devise de référence. */
export type ConvertedTotal = {
  currency: string;
  amount: string;
  /** Devises présentes dans la période mais sans taux : exclues du total. */
  missingRates: string[];
};

export type AdminOverviewResponse = {
  range: InsightsRange;
  referenceCurrency: string;
  users: { total: number; new: number; previousNew: number; withCountry: number };
  payingUsers: number;
  subscriptions: { active: number; newInRange: number; previousNewInRange: number };
  publications: { inRange: number; previous: number };
  orders: { paid: number; previousPaid: number };
  revenue: { byCurrency: Money[]; total: ConvertedTotal; previousTotal: ConvertedTotal };
  /** Comptes ayant eu le droit gratuit, et parmi eux ceux qui ont acheté ensuite. */
  conversion: { freeUsers: number; convertedUsers: number };
  reports: { open: number };
};

export type TimeseriesPoint = {
  /** Premier jour de l'intervalle (AAAA-MM-JJ), dans le fuseau demandé. */
  date: string;
  signups: number;
  publications: number;
  newSubscriptions: number;
  paidOrders: number;
  /** Montant par devise d'origine. */
  revenue: Record<string, string>;
  /** Total converti (devises sans taux exclues). */
  revenueTotal: string;
};

export type AdminTimeseriesResponse = {
  interval: (typeof INSIGHTS_INTERVALS)[number];
  tz: string;
  referenceCurrency: string;
  currencies: string[];
  missingRates: string[];
  points: TimeseriesPoint[];
};

export type GeoRow = {
  users: number;
  newUsers: number;
  payingUsers: number;
  paidOrders: number;
  revenueTotal: string;
};

export type AdminGeoResponse = {
  range: InsightsRange;
  referenceCurrency: string;
  missingRates: string[];
  countries: Array<GeoRow & { code: string; continent: Continent }>;
  continents: Array<GeoRow & { continent: Continent }>;
  /** Comptes et ventes dont le pays n'est pas connu. */
  unknown: GeoRow;
};

export type LicenseStatusCounts = { pending: number; active: number; expired: number; revoked: number; refunded: number };

export type AdminSubscriptionsResponse = {
  activeTotal: number;
  byPlan: Array<{ planCode: string; planName: string; isFree: boolean } & LicenseStatusCounts>;
  bySource: Array<{ source: "free" | "purchase" | "admin_grant" | "promotion"; active: number }>;
  expiringSoon: Array<{ licenseId: string; userId: string; planCode: string; planName: string; endsAt: string }>;
};

export type CalendarDay = {
  date: string;
  signups: number;
  publications: number;
  newSubscriptions: number;
  paidOrders: number;
  revenueTotal: string;
  licenseExpirations: number;
};

export type CalendarEvent = {
  date: string;
  kind: "license_expirations" | "exchange_rate" | "plan_price";
  /** Détail factuel : code de formule, devise… */
  subject: string;
  count: number;
};

export type AdminCalendarResponse = {
  month: string;
  tz: string;
  referenceCurrency: string;
  missingRates: string[];
  days: CalendarDay[];
  events: CalendarEvent[];
};

// ---------------------------------------------------------------------
// Journal d'audit
// ---------------------------------------------------------------------

export const AUDIT_ACTOR_TYPES = ["user", "admin", "system", "provider", "anonymous"] as const;

export const adminAuditQuerySchema = z.object({
  action: z.string().regex(/^[a-z0-9_.]{2,80}$/).optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPES).optional(),
  entityType: z.string().regex(/^[a-z0-9_]{2,60}$/).optional(),
  actorId: z.uuid().optional(),
  entityId: z.string().min(1).max(100).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  /** Identifiant de la dernière ligne reçue (pagination par curseur, du plus récent au plus ancien). */
  cursor: z.string().regex(/^\d{1,19}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export type AuditItem = {
  id: string;
  occurredAt: string;
  actorType: (typeof AUDIT_ACTOR_TYPES)[number];
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  data: Record<string, unknown>;
  requestId: string | null;
};

export type AdminAuditResponse = { items: AuditItem[]; nextCursor: string | null };
export type AdminAuditFacetsResponse = { actions: string[]; entityTypes: string[] };

// ---------------------------------------------------------------------
// Taux de change (paramètres administrables)
// ---------------------------------------------------------------------

export const adminExchangeRateSchema = z.strictObject({
  currency,
  /** Valeur d'UNE unité de `currency` dans la devise de référence. */
  rate: z.string().regex(/^\d{1,12}(\.\d{1,10})?$/, "taux décimal positif attendu").refine((v) => Number(v) > 0, "taux positif attendu"),
  validFrom: isoDate,
});
export type AdminExchangeRateRequest = z.infer<typeof adminExchangeRateSchema>;

export const adminReferenceCurrencySchema = z.strictObject({ currency });

export type ExchangeRateItem = {
  id: string;
  currency: string;
  referenceCurrency: string;
  rate: string;
  validFrom: string;
  createdAt: string;
};

export type AdminExchangeRatesResponse = { referenceCurrency: string; rates: ExchangeRateItem[] };

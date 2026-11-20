/**
 * DONNÉES DE DÉMONSTRATION — générées, fictives, pour développer et vérifier
 * l'écran sans base de données. Activées seulement par NEXT_PUBLIC_ADMIN_DEMO=1
 * hors production (voir config.ts) ; un bandeau l'indique sur chaque page.
 *
 * Le générateur est déterministe (même graine, mêmes chiffres) et applique les
 * MÊMES règles que l'API : ventes « paid » datées par paiement, conversion par
 * le dernier taux en vigueur ce jour-là, devise sans taux exclue du total.
 */
import {
  type AdminAuditQuery,
  type AdminCalendarResponse,
  type AdminGeoResponse,
  type AdminOverviewResponse,
  type AdminPaymentSettingsResponse,
  type AdminSubscriptionsResponse,
  type AdminTimeseriesResponse,
  type AuditItem,
  type CalendarEvent,
  CONTINENTS,
  continentOf,
  type ExchangeRateItem,
  type GeoRow,
  type InsightsRange,
  type InsightsTimeseriesQuery,
  type TimeseriesPoint,
} from "@zaweli/shared-types";
import type { AdminApi } from "./api";
import { ApiRequestError } from "./api";
import { addDays, daysBetween, today } from "./range";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNTRY_WEIGHTS: Array<[string | null, number]> = [
  ["CD", 30], ["FR", 10], ["BE", 6], ["CG", 6], ["CM", 5], ["CI", 5], ["US", 5], ["SN", 4], ["CA", 4], ["GB", 3], ["NG", 3],
  ["KE", 2], ["ZA", 2], ["MA", 2], ["DE", 2], ["GA", 2], ["RW", 1.5], ["CH", 1], ["BR", 1], ["IN", 1], ["AE", 1], ["AO", 1],
  ["AU", 0.5], ["JP", 0.5], ["MX", 0.5], [null, 8],
];
const CURRENCY_OF: Record<string, string> = { CD: "USD", CG: "XAF", CM: "XAF", GA: "XAF", CI: "XOF", SN: "XOF", GB: "GBP" };
const EURO = new Set(["FR", "BE", "DE"]);
const PLANS = [
  { code: "FREE", name: "Découverte", isFree: true, days: null },
  { code: "SOLO", name: "Solo", isFree: false, days: 7 },
  { code: "MULTI_USE", name: "Multi-usage", isFree: false, days: 30 },
  { code: "ANNUAL", name: "Annuelle", isFree: false, days: 365 },
] as const;
/** Prix FICTIFS de démonstration, par formule et par devise. */
const DEMO_PRICES: Record<string, Record<string, number>> = {
  SOLO: { USD: 5, CDF: 14000, EUR: 4.5, XOF: 3000, XAF: 3000, GBP: 4 },
  MULTI_USE: { USD: 12, CDF: 33000, EUR: 11, XOF: 7500, XAF: 7500, GBP: 10 },
  ANNUAL: { USD: 49, CDF: 135000, EUR: 45, XOF: 30000, XAF: 30000, GBP: 40 },
};

type User = { id: string; day: string; country: string | null };
type Order = { id: string; userId: string; day: string; currency: string; amount: number; country: string | null; plan: string };
type License = { id: string; userId: string; plan: string; source: "free" | "purchase" | "admin_grant" | "promotion"; created: string; ends: string | null; status: "active" | "expired" };
type Rate = ExchangeRateItem;

const uuid = (rand: () => number) =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(rand() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

function pick<T>(rand: () => number, weights: Array<[T, number]>): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [value, w] of weights) if ((x -= w) <= 0) return value;
  return weights[weights.length - 1]![0];
}

function generate(tz: string) {
  const rand = mulberry32(20261118);
  const end = today(tz);
  const start = addDays(end, -460);
  const users: User[] = [];
  const orders: Order[] = [];
  const licenses: License[] = [];
  const publications: string[] = [];

  for (let i = 0; i <= 460; i++) {
    const day = addDays(start, i);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const growth = 3 + (i / 460) ** 1.6 * 30;
    const weekly = weekday === 0 || weekday === 6 ? 1.35 : 1;
    // Pics : Saint-Valentin, fête des mères (fin mai), fêtes de fin d'année.
    const md = day.slice(5);
    const peak = md >= "02-08" && md <= "02-14" ? 2.2 : md >= "05-20" && md <= "05-31" ? 1.6 : md >= "12-15" && md <= "12-31" ? 1.9 : 1;
    const count = Math.round(growth * weekly * peak * (0.7 + rand() * 0.6));
    for (let k = 0; k < count; k++) {
      const user: User = { id: uuid(rand), day, country: pick(rand, COUNTRY_WEIGHTS) };
      users.push(user);
      if (rand() < 0.62) {
        const pubDay = addDays(day, Math.floor(rand() * 4));
        if (pubDay <= end) {
          publications.push(pubDay);
          licenses.push({ id: uuid(rand), userId: user.id, plan: "FREE", source: "free", created: day, ends: null, status: "active" });
        }
      }
      let buys = rand() < 0.16 ? 1 + Math.floor(rand() * rand() * 4) : 0;
      let buyDay = addDays(day, 1 + Math.floor(rand() * 12));
      while (buys-- > 0 && buyDay <= end) {
        const plan = pick(rand, [["SOLO", 6], ["MULTI_USE", 3], ["ANNUAL", 0.6]] as Array<[string, number]>);
        const country = user.country;
        let currency = country ? (CURRENCY_OF[country] ?? (EURO.has(country) ? "EUR" : "USD")) : "USD";
        if (country === "CD" && rand() < 0.4) currency = "CDF";
        orders.push({ id: uuid(rand), userId: user.id, day: buyDay, currency, amount: DEMO_PRICES[plan]![currency]!, country, plan });
        const days = PLANS.find((p) => p.code === plan)!.days!;
        const ends = addDays(buyDay, days);
        licenses.push({ id: uuid(rand), userId: user.id, plan, source: "purchase", created: buyDay, ends, status: ends > end ? "active" : "expired" });
        for (let p = 0; p < 1 + Math.floor(rand() * 3); p++) {
          const d = addDays(buyDay, Math.floor(rand() * days * 0.6));
          if (d <= end) publications.push(d);
        }
        buyDay = addDays(buyDay, 10 + Math.floor(rand() * 60));
      }
    }
  }
  // Quelques gestes commerciaux.
  for (let i = 0; i < 25; i++) {
    const user = users[Math.floor(rand() * users.length)]!;
    const created = addDays(end, -Math.floor(rand() * 120));
    const ends = addDays(created, 30);
    licenses.push({ id: uuid(rand), userId: user.id, plan: "MULTI_USE", source: "admin_grant", created, ends, status: ends > end ? "active" : "expired" });
  }

  const rates: Rate[] = [
    { currency: "CDF", rate: "0.000357", validFrom: addDays(start, 0) },
    { currency: "CDF", rate: "0.000352", validFrom: addDays(end, -40) },
    { currency: "EUR", rate: "1.08", validFrom: addDays(start, 0) },
    { currency: "XOF", rate: "0.00165", validFrom: addDays(start, 0) },
    { currency: "XAF", rate: "0.00165", validFrom: addDays(start, 0) },
    // GBP volontairement sans taux : montre l'avertissement « devise sans taux ».
  ].map((r, i) => ({ id: `rate-${i}`, referenceCurrency: "USD", createdAt: `${r.validFrom}T09:00:00.000Z`, ...r }));

  const audit: AuditItem[] = [];
  let auditId = 1;
  const push = (day: string, a: Omit<AuditItem, "id" | "occurredAt" | "requestId">) =>
    audit.push({ id: String(auditId++), occurredAt: `${day}T${String(8 + Math.floor(rand() * 12)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00.000Z`, requestId: uuid(rand), ...a });
  for (const o of orders.slice(-400)) {
    push(o.day, { actorType: "provider", actorId: null, action: "order.paid", entityType: "order", entityId: o.id, data: { amount: o.amount.toFixed(2), currency: o.currency, plan: o.plan } });
    push(o.day, { actorType: "system", actorId: null, action: "license.activated", entityType: "license", entityId: uuid(rand), data: { plan: o.plan } });
  }
  for (const d of publications.slice(-600)) push(d, { actorType: "user", actorId: uuid(rand), action: "experience.published", entityType: "experience", entityId: uuid(rand), data: {} });
  const adminId = "a11ce000-0000-4000-8000-000000000001";
  for (const l of licenses.filter((x) => x.source === "admin_grant"))
    push(l.created, { actorType: "admin", actorId: adminId, action: "license.granted", entityType: "license", entityId: l.id, data: { plan: l.plan, reason: "geste commercial" } });
  for (const r of rates) push(r.validFrom, { actorType: "admin", actorId: adminId, action: "exchange_rate.created", entityType: "exchange_rate", entityId: r.id, data: { currency: r.currency, rate: r.rate } });
  for (let i = 0; i < 12; i++)
    push(addDays(end, -Math.floor(rand() * 90)), { actorType: "admin", actorId: adminId, action: rand() < 0.5 ? "report.suspend" : "report.dismiss", entityType: "report", entityId: uuid(rand), data: {} });
  audit.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  audit.forEach((a, i) => (a.id = String(i + 1)));

  return { end, users, orders, licenses, publications, rates, audit, reference: "USD", openReports: 3 };
}

type Dataset = ReturnType<typeof generate>;

const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const inRange = (day: string, r: { from: string; to: string }) => day >= r.from && day <= r.to;

function bucketStart(date: string, interval: InsightsTimeseriesQuery["interval"]) {
  if (interval === "day") return date;
  if (interval === "month") return `${date.slice(0, 7)}-01`;
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}

/** Comme l'API : chaque geste de l'administration est journalisé. */
function journal(d: Dataset, action: string, entityType: string, entityId: string, data: Record<string, unknown>) {
  d.audit.push({
    id: String(d.audit.length + 1),
    occurredAt: new Date().toISOString(),
    actorType: "admin",
    actorId: "a11ce000-0000-4000-8000-000000000001",
    action,
    entityType,
    entityId,
    data,
    requestId: null,
  });
}

const demoReadOnly = () => new ApiRequestError(409, "CONFLICT", "Démonstration : cette action n'est possible qu'avec l'API réelle.");

const demoPayments: AdminPaymentSettingsResponse = {
  mode: "sandbox",
  webhookUrl: null,
  moneyFeeRate: null,
  moneyTransfersEnabled: false,
  refereeDiscountRate: null,
  rewardTiers: [
    { threshold: 25, amount: "5.00", currency: "USD" },
    { threshold: 50, amount: "10.00", currency: "USD" },
  ],
};

export function createDemoApi(tz: string): AdminApi {
  let data: Dataset | null = null;
  const db = () => (data ??= generate(tz));
  // Réponse asynchrone comme l'API, copiée (l'écran ne peut pas modifier le jeu de données).
  const wait = <T>(value: T) => Promise.resolve().then(() => structuredClone(value));

  /** Taux en vigueur un jour donné vers la référence courante (null : aucun). */
  const rateOn = (d: Dataset, currency: string, day: string) => {
    if (currency === d.reference) return 1;
    const r = d.rates.filter((x) => x.currency === currency && x.referenceCurrency === d.reference && x.validFrom <= day).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    return r ? Number(r.rate) : null;
  };
  const paid = (d: Dataset, r: { from: string; to: string }) => {
    const rows = d.orders.filter((o) => inRange(o.day, r)).map((o) => ({ ...o, rate: rateOn(d, o.currency, o.day) }));
    const missing = new Set(rows.filter((o) => o.rate === null).map((o) => o.currency));
    return { rows, missing, converted: (o: (typeof rows)[number]) => (missing.has(o.currency) ? 0 : o.amount * (o.rate ?? 0)) };
  };
  const previous = (r: InsightsRange) => {
    const len = daysBetween(r.from, r.to) + 1;
    return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
  };
  const revenue = (d: Dataset, r: { from: string; to: string }) => {
    const p = paid(d, r);
    const byCurrency = new Map<string, number>();
    for (const o of p.rows) byCurrency.set(o.currency, (byCurrency.get(o.currency) ?? 0) + o.amount);
    return {
      byCurrency: [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: round2(amount) })),
      total: { currency: d.reference, amount: round2(p.rows.reduce((s, o) => s + p.converted(o), 0)), missingRates: [...p.missing].sort() },
    };
  };

  const timeseries = (q: InsightsTimeseriesQuery): AdminTimeseriesResponse => {
    const d = db();
    const points = new Map<string, TimeseriesPoint>();
    for (let day = bucketStart(q.from, q.interval); day <= q.to; ) {
      points.set(day, { date: day, signups: 0, publications: 0, newSubscriptions: 0, paidOrders: 0, revenue: {}, revenueTotal: "0.00" });
      if (q.interval === "day") day = addDays(day, 1);
      else if (q.interval === "week") day = addDays(day, 7);
      else {
        const [y, m] = day.split("-").map(Number) as [number, number];
        day = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      }
    }
    const at = (day: string) => points.get(bucketStart(day, q.interval));
    for (const u of d.users) if (inRange(u.day, q)) at(u.day)!.signups++;
    for (const p of d.publications) if (inRange(p, q)) at(p)!.publications++;
    for (const l of d.licenses) if (l.source !== "free" && inRange(l.created, q)) at(l.created)!.newSubscriptions++;
    const p = paid(d, q);
    const totals = new Map<string, number>();
    for (const o of p.rows) {
      const point = at(o.day)!;
      point.paidOrders++;
      point.revenue[o.currency] = round2(Number(point.revenue[o.currency] ?? 0) + o.amount);
      totals.set(point.date, (totals.get(point.date) ?? 0) + p.converted(o));
    }
    for (const [date, total] of totals) points.get(date)!.revenueTotal = round2(total);
    return {
      interval: q.interval,
      tz: q.tz,
      referenceCurrency: d.reference,
      currencies: [...new Set(p.rows.map((o) => o.currency))].sort(),
      missingRates: [...p.missing].sort(),
      points: [...points.values()],
    };
  };

  return {
    me: () => wait({ id: "a11ce000-0000-4000-8000-000000000001", email: "demo@zaweli.test", roles: ["admin"] }),

    overview: (r) => {
      const d = db();
      const prev = previous(r);
      const countIn = (days: string[], range: { from: string; to: string }) => days.filter((x) => inRange(x, range)).length;
      const subs = d.licenses.filter((l) => l.source !== "free");
      const freeUsers = new Set(d.licenses.filter((l) => l.source === "free").map((l) => l.userId));
      const payers = new Set(d.orders.map((o) => o.userId));
      const current = revenue(d, r);
      const response: AdminOverviewResponse = {
        range: r,
        referenceCurrency: d.reference,
        users: {
          total: d.users.length,
          new: countIn(d.users.map((u) => u.day), r),
          previousNew: countIn(d.users.map((u) => u.day), prev),
          withCountry: d.users.filter((u) => u.country).length,
        },
        payingUsers: payers.size,
        subscriptions: {
          active: subs.filter((l) => l.status === "active").length,
          newInRange: countIn(subs.map((l) => l.created), r),
          previousNewInRange: countIn(subs.map((l) => l.created), prev),
        },
        publications: { inRange: countIn(d.publications, r), previous: countIn(d.publications, prev) },
        orders: { paid: countIn(d.orders.map((o) => o.day), r), previousPaid: countIn(d.orders.map((o) => o.day), prev) },
        revenue: { byCurrency: current.byCurrency, total: current.total, previousTotal: revenue(d, prev).total },
        conversion: { freeUsers: freeUsers.size, convertedUsers: [...freeUsers].filter((id) => payers.has(id)).length },
        reports: { open: d.openReports },
      };
      return wait(response);
    },

    timeseries: (q) => wait(timeseries(q)),

    geo: (r) => {
      const d = db();
      const empty = (): GeoRow => ({ users: 0, newUsers: 0, payingUsers: 0, paidOrders: 0, revenueTotal: "0.00" });
      const rows = new Map<string, GeoRow & { revenue: number; payers: Set<string> }>();
      const unknown = { ...empty(), revenue: 0, payers: new Set<string>() };
      const row = (code: string | null) => {
        if (!code || !continentOf(code)) return unknown;
        if (!rows.has(code)) rows.set(code, { ...empty(), revenue: 0, payers: new Set() });
        return rows.get(code)!;
      };
      for (const u of d.users) {
        const x = row(u.country);
        x.users++;
        if (inRange(u.day, r)) x.newUsers++;
      }
      const p = paid(d, r);
      for (const o of p.rows) {
        const x = row(o.country);
        x.paidOrders++;
        x.payers.add(o.userId);
        x.revenue += p.converted(o);
      }
      const finish = ({ revenue: amount, payers, ...x }: GeoRow & { revenue: number; payers: Set<string> }): GeoRow => ({ ...x, payingUsers: payers.size, revenueTotal: round2(amount) });
      const countries = [...rows.entries()]
        .map(([code, x]) => ({ code, continent: continentOf(code)!, ...finish(x) }))
        .sort((a, b) => b.users - a.users);
      const response: AdminGeoResponse = {
        range: r,
        referenceCurrency: d.reference,
        missingRates: [...p.missing].sort(),
        countries,
        continents: CONTINENTS.map((continent) => {
          const list = countries.filter((c) => c.continent === continent);
          return {
            continent,
            users: list.reduce((s, c) => s + c.users, 0),
            newUsers: list.reduce((s, c) => s + c.newUsers, 0),
            payingUsers: list.reduce((s, c) => s + c.payingUsers, 0),
            paidOrders: list.reduce((s, c) => s + c.paidOrders, 0),
            revenueTotal: round2(list.reduce((s, c) => s + Number(c.revenueTotal), 0)),
          };
        }),
        unknown: finish(unknown),
      };
      return wait(response);
    },

    subscriptions: () => {
      const d = db();
      const soon = addDays(d.end, 30);
      const response: AdminSubscriptionsResponse = {
        activeTotal: d.licenses.filter((l) => l.status === "active").length,
        byPlan: PLANS.map((p) => {
          const list = d.licenses.filter((l) => l.plan === p.code);
          return {
            planCode: p.code,
            planName: p.name,
            isFree: p.isFree,
            pending: 0,
            active: list.filter((l) => l.status === "active").length,
            expired: list.filter((l) => l.status === "expired").length,
            revoked: 0,
            refunded: 0,
          };
        }),
        bySource: (["free", "purchase", "admin_grant", "promotion"] as const)
          .map((source) => ({ source, active: d.licenses.filter((l) => l.source === source && l.status === "active").length }))
          .filter((x) => x.active > 0)
          .sort((a, b) => b.active - a.active),
        expiringSoon: d.licenses
          .filter((l) => l.status === "active" && l.ends && l.ends > d.end && l.ends <= soon)
          .sort((a, b) => a.ends!.localeCompare(b.ends!))
          .slice(0, 50)
          .map((l) => ({ licenseId: l.id, userId: l.userId, planCode: l.plan, planName: PLANS.find((p) => p.code === l.plan)!.name, endsAt: `${l.ends}T12:00:00.000Z` })),
      };
      return wait(response);
    },

    calendar: (month, zone) => {
      const d = db();
      const [y, m] = month.split("-").map(Number) as [number, number];
      const from = `${month}-01`;
      const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const series = timeseries({ from, to, tz: zone, interval: "day" });
      const expirations = d.licenses.filter((l) => l.ends && inRange(l.ends, { from, to }));
      const events: CalendarEvent[] = [];
      const byDayPlan = new Map<string, number>();
      for (const l of expirations) byDayPlan.set(`${l.ends}|${l.plan}`, (byDayPlan.get(`${l.ends}|${l.plan}`) ?? 0) + 1);
      for (const [key, count] of byDayPlan) {
        const [date, subject] = key.split("|") as [string, string];
        events.push({ date, kind: "license_expirations", subject, count });
      }
      for (const r of d.rates) if (r.referenceCurrency === d.reference && inRange(r.validFrom, { from, to })) events.push({ date: r.validFrom, kind: "exchange_rate", subject: r.currency, count: 1 });
      events.sort((a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject));
      const response: AdminCalendarResponse = {
        month,
        tz: zone,
        referenceCurrency: d.reference,
        missingRates: series.missingRates,
        days: series.points.map((p) => ({
          date: p.date,
          signups: p.signups,
          publications: p.publications,
          newSubscriptions: p.newSubscriptions,
          paidOrders: p.paidOrders,
          revenueTotal: p.revenueTotal,
          licenseExpirations: expirations.filter((l) => l.ends === p.date).length,
        })),
        events,
      };
      return wait(response);
    },

    audit: (q: Partial<AdminAuditQuery>) => {
      const d = db();
      const limit = q.limit ?? 50;
      const rows = d.audit
        .filter(
          (a) =>
            (!q.action || a.action === q.action) &&
            (!q.actorType || a.actorType === q.actorType) &&
            (!q.entityType || a.entityType === q.entityType) &&
            (!q.entityId || a.entityId === q.entityId) &&
            (!q.actorId || a.actorId === q.actorId) &&
            (!q.from || a.occurredAt.slice(0, 10) >= q.from) &&
            (!q.to || a.occurredAt.slice(0, 10) <= q.to) &&
            (!q.cursor || Number(a.id) < Number(q.cursor)),
        )
        .reverse();
      const page = rows.slice(0, limit);
      return wait({ items: page, nextCursor: rows.length > limit ? page.at(-1)!.id : null });
    },

    auditFacets: () => {
      const d = db();
      return wait({ actions: [...new Set(d.audit.map((a) => a.action))].sort(), entityTypes: [...new Set(d.audit.map((a) => a.entityType))].sort() });
    },

    exchangeRates: () => {
      const d = db();
      return wait({ referenceCurrency: d.reference, rates: [...d.rates].sort((a, b) => b.validFrom.localeCompare(a.validFrom) || a.currency.localeCompare(b.currency)) });
    },

    addExchangeRate: async (body) => {
      const d = db();
      if (body.currency === d.reference) throw new ApiRequestError(400, "VALIDATION_FAILED", "La devise de référence vaut toujours 1.");
      if (d.rates.some((r) => r.currency === body.currency && r.referenceCurrency === d.reference && r.validFrom === body.validFrom))
        throw new ApiRequestError(409, "EXCHANGE_RATE_EXISTS", "Un taux existe déjà pour cette devise à cette date. Saisissez-en un à une autre date.");
      d.rates.push({ id: `rate-${d.rates.length}`, currency: body.currency, referenceCurrency: d.reference, rate: body.rate, validFrom: body.validFrom, createdAt: new Date().toISOString() });
      journal(d, "exchange_rate.created", "exchange_rate", `rate-${d.rates.length - 1}`, { currency: body.currency, referenceCurrency: d.reference, rate: body.rate, validFrom: body.validFrom });
      return createDemoApiFor(d).exchangeRates();
    },

    setReferenceCurrency: async (currency) => {
      const d = db();
      journal(d, "settings.reference_currency_changed", "app_setting", "finance.reference_currency", { from: d.reference, to: currency });
      d.reference = currency;
      return createDemoApiFor(d).exchangeRates();
    },

    // Paiements : réglages en mémoire ; pas de commandes inventées (la démonstration le dit).
    paymentSettings: () => wait({ ...demoPayments }),
    updatePaymentSettings: async (body) => {
      const d = db();
      Object.assign(demoPayments, Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
      journal(d, "setting.updated", "app_setting", "payments", body as Record<string, unknown>);
      return wait({ ...demoPayments });
    },
    paymentOrders: () => wait([]),
    paymentTransfers: () => wait([]),
    reconcilePayments: () => wait({ checked: 0, settled: 0 }),
    referrers: () => wait([]),
    // Gestion : la démonstration ne fabrique ni comptes ni signalements (lecture vide, écritures refusées).
    users: () => wait([]),
    user: () => Promise.reject(new ApiRequestError(404, "USER_NOT_FOUND", "Démonstration : aucun compte réel.")),
    suspendUser: () => Promise.reject(demoReadOnly()),
    unsuspendUser: () => Promise.reject(demoReadOnly()),
    grantLicense: () => Promise.reject(demoReadOnly()),
    revokeLicense: () => Promise.reject(demoReadOnly()),
    plans: () => wait([]),
    createPlan: () => Promise.reject(demoReadOnly()),
    updatePlan: () => Promise.reject(demoReadOnly()),
    setPrice: () => Promise.reject(demoReadOnly()),
    templates: () => wait([]),
    updateTemplate: () => Promise.reject(demoReadOnly()),
    reports: () => wait([]),
    resolveReport: () => Promise.reject(demoReadOnly()),
    suspendedExperiences: () => wait([]),
    suspendExperience: () => Promise.reject(demoReadOnly()),
    unsuspendExperience: () => Promise.reject(demoReadOnly()),
  };

  function createDemoApiFor(d: Dataset) {
    return {
      exchangeRates: () =>
        wait({ referenceCurrency: d.reference, rates: [...d.rates].sort((a, b) => b.validFrom.localeCompare(a.validFrom) || a.currency.localeCompare(b.currency)) }),
    };
  }
}

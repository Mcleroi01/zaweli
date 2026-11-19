import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminCalendarResponse,
  type AdminGeoResponse,
  type AdminOverviewResponse,
  type AdminSubscriptionsResponse,
  type AdminTimeseriesResponse,
  type CalendarEvent,
  type Continent,
  CONTINENTS,
  continentOf,
  type GeoRow,
  type InsightsRange,
  type InsightsTimeseriesQuery,
  type LicenseStatusCounts,
  type TimeseriesPoint,
} from "@zaweli/shared-types";
import { type RawBuilder, sql } from "kysely";
import { DB } from "../database/database.module.js";
import { type Db, readSetting, toIso } from "../database/transaction.js";

type Interval = InsightsTimeseriesQuery["interval"];

// ------------------------------------------------------------------
// Dates « locales » (AAAA-MM-JJ, déjà dans le fuseau demandé)
// ------------------------------------------------------------------

const DAY = 86_400_000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** Début d'intervalle, identique à date_trunc de PostgreSQL (semaine ISO : lundi). */
function bucketStart(date: string, interval: Interval): string {
  if (interval === "day") return date;
  if (interval === "month") return `${date.slice(0, 7)}-01`;
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
  return addDays(date, -weekday);
}

function bucketsOf(from: string, to: string, interval: Interval): string[] {
  const out: string[] = [];
  let cursor = bucketStart(from, interval);
  while (cursor <= to) {
    out.push(cursor);
    if (interval === "day") cursor = addDays(cursor, 1);
    else if (interval === "week") cursor = addDays(cursor, 7);
    else {
      const [y, m] = cursor.split("-").map(Number) as [number, number];
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
  }
  return out;
}

/** Période précédente de même durée, juste avant `range`. */
export function previousRange(range: InsightsRange): InsightsRange {
  const length = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1), tz: range.tz };
}

/** Bornes SQL [début, fin[ d'une période, minuit à minuit dans le fuseau demandé. */
const start = (r: InsightsRange) => sql`(cast(${r.from} as date)::timestamp at time zone ${r.tz})`;
const end = (r: InsightsRange) => sql`((cast(${r.to} as date) + 1)::timestamp at time zone ${r.tz})`;
const within = (column: RawBuilder<unknown>, r: InsightsRange) => sql`${column} >= ${start(r)} and ${column} < ${end(r)}`;
const localDay = (column: RawBuilder<unknown>, tz: string) => sql`(${column} at time zone ${tz})::date`;

const emptyGeo = (): GeoRow => ({ users: 0, newUsers: 0, payingUsers: 0, paidOrders: 0, revenueTotal: "0.00" });
/** Somme décimale exacte de deux montants « 12.34 » (en centimes, sans flottant). */
function addAmounts(a: string, b: string): string {
  const cents = (v: string) => {
    const [int = "0", frac = ""] = v.split(".");
    const sign = int.startsWith("-") ? -1n : 1n;
    return BigInt(int) * 100n + sign * BigInt((frac + "00").slice(0, 2));
  };
  const total = cents(a) + cents(b);
  const abs = total < 0n ? -total : total;
  return `${total < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

/**
 * Statistiques de l'administration, calculées directement dans PostgreSQL.
 *
 * Chiffre d'affaires : commandes au statut « paid » (un remboursement le
 * retire), datées par `paid_at`. Total converti : taux saisis dans
 * app.exchange_rates, le plus récent en vigueur le jour du paiement. Une
 * devise sans taux est exclue du total et signalée, jamais estimée.
 *
 * Pays d'une vente : celui figé sur la commande, à défaut celui du compte.
 */
@Injectable()
export class InsightsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  referenceCurrency(): Promise<string> {
    return readSetting(this.db, "finance.reference_currency", "USD");
  }

  /** Commandes payées d'une période, avec leur montant converti (null : pas de taux). */
  private paid(ref: string, r: InsightsRange) {
    return sql`
      select o.id, o.user_id, o.currency, o.amount, o.paid_at,
             coalesce(o.country_code, p.country_code) as country_code,
             case when o.currency = ${ref} then o.amount else o.amount * rt.rate end as converted
        from app.orders o
        left join app.profiles p on p.id = o.user_id
        left join lateral (
          select er.rate from app.exchange_rates er
           where er.currency = o.currency and er.reference_currency = ${ref}
             and er.valid_from <= ${localDay(sql`o.paid_at`, r.tz)}
           order by er.valid_from desc
           limit 1
        ) rt on true
       where o.status = 'paid' and ${within(sql`o.paid_at`, r)}`;
  }

  private async revenue(ref: string, r: InsightsRange) {
    const { rows } = await sql<{ currency: string; amount: string; converted: string | null; missing: boolean }>`
      with paid as (${this.paid(ref, r)})
      select currency, sum(amount)::text as amount, round(sum(converted), 2)::text as converted, bool_or(converted is null) as missing
        from paid group by currency order by currency`.execute(this.db);
    const total = rows.reduce((acc, row) => (row.missing ? acc : addAmounts(acc, row.converted ?? "0")), "0.00");
    return {
      byCurrency: rows.map((row) => ({ currency: row.currency, amount: row.amount })),
      total: { currency: ref, amount: total, missingRates: rows.filter((row) => row.missing).map((row) => row.currency) },
    };
  }

  // ------------------------------------------------------------------
  // Vue d'ensemble
  // ------------------------------------------------------------------

  async overview(range: InsightsRange): Promise<AdminOverviewResponse> {
    const ref = await this.referenceCurrency();
    const prev = previousRange(range);

    const { rows: counts } = await sql<{
      users: number;
      with_country: number;
      new_users: number;
      prev_new_users: number;
      paying: number;
      active_subs: number;
      new_subs: number;
      prev_new_subs: number;
      publications: number;
      prev_publications: number;
      paid_orders: number;
      prev_paid_orders: number;
      free_users: number;
      converted_users: number;
      open_reports: number;
    }>`
      select
        (select count(*)::int from app.profiles where deleted_at is null) as users,
        (select count(*)::int from app.profiles where deleted_at is null and country_code is not null) as with_country,
        (select count(*)::int from app.profiles where ${within(sql`created_at`, range)}) as new_users,
        (select count(*)::int from app.profiles where ${within(sql`created_at`, prev)}) as prev_new_users,
        (select count(distinct user_id)::int from app.orders where status = 'paid') as paying,
        (select count(*)::int from app.licenses where status = 'active' and source <> 'free' and (ends_at is null or ends_at > now())) as active_subs,
        (select count(*)::int from app.licenses where source <> 'free' and ${within(sql`created_at`, range)}) as new_subs,
        (select count(*)::int from app.licenses where source <> 'free' and ${within(sql`created_at`, prev)}) as prev_new_subs,
        (select count(*)::int from app.experiences where ${within(sql`first_published_at`, range)}) as publications,
        (select count(*)::int from app.experiences where ${within(sql`first_published_at`, prev)}) as prev_publications,
        (select count(*)::int from app.orders where status = 'paid' and ${within(sql`paid_at`, range)}) as paid_orders,
        (select count(*)::int from app.orders where status = 'paid' and ${within(sql`paid_at`, prev)}) as prev_paid_orders,
        (select count(distinct user_id)::int from app.licenses where source = 'free') as free_users,
        (select count(distinct l.user_id)::int from app.licenses l
          where l.source = 'free' and exists (select 1 from app.orders o where o.user_id = l.user_id and o.status = 'paid')) as converted_users,
        (select count(*)::int from app.reports where status = 'open') as open_reports
    `.execute(this.db);
    const c = counts[0]!;
    const [current, previous] = await Promise.all([this.revenue(ref, range), this.revenue(ref, prev)]);

    return {
      range,
      referenceCurrency: ref,
      users: { total: c.users, new: c.new_users, previousNew: c.prev_new_users, withCountry: c.with_country },
      payingUsers: c.paying,
      subscriptions: { active: c.active_subs, newInRange: c.new_subs, previousNewInRange: c.prev_new_subs },
      publications: { inRange: c.publications, previous: c.prev_publications },
      orders: { paid: c.paid_orders, previousPaid: c.prev_paid_orders },
      revenue: { byCurrency: current.byCurrency, total: current.total, previousTotal: previous.total },
      conversion: { freeUsers: c.free_users, convertedUsers: c.converted_users },
      reports: { open: c.open_reports },
    };
  }

  // ------------------------------------------------------------------
  // Séries temporelles (jour, semaine, mois)
  // ------------------------------------------------------------------

  async timeseries(q: InsightsTimeseriesQuery): Promise<AdminTimeseriesResponse> {
    const ref = await this.referenceCurrency();
    const range: InsightsRange = { from: q.from, to: q.to, tz: q.tz };
    const bucket = (column: RawBuilder<unknown>) => sql`date_trunc(${q.interval}, ${column} at time zone ${q.tz})::date::text`;
    const countBy = async (table: "app.profiles" | "app.experiences" | "app.licenses", column: string, extra = sql`true`) => {
      const col = sql.ref(column);
      const { rows } = await sql<{ b: string; n: number }>`
        select ${bucket(col)} as b, count(*)::int as n
          from ${sql.table(table)}
         where ${within(col, range)} and ${extra}
         group by 1`.execute(this.db);
      return new Map(rows.map((row) => [row.b, row.n]));
    };

    const [signups, publications, subscriptions, orders] = await Promise.all([
      countBy("app.profiles", "created_at"),
      countBy("app.experiences", "first_published_at"),
      countBy("app.licenses", "created_at", sql`source <> 'free'`),
      sql<{ b: string; currency: string; n: number; amount: string; converted: string | null; missing: boolean }>`
        with paid as (${this.paid(ref, range)})
        select ${bucket(sql`paid_at`)} as b, currency, count(*)::int as n, sum(amount)::text as amount,
               round(sum(converted), 2)::text as converted, bool_or(converted is null) as missing
          from paid group by 1, 2`.execute(this.db),
    ]);

    const points = new Map<string, TimeseriesPoint>(
      bucketsOf(q.from, q.to, q.interval).map((date) => [
        date,
        {
          date,
          signups: signups.get(date) ?? 0,
          publications: publications.get(date) ?? 0,
          newSubscriptions: subscriptions.get(date) ?? 0,
          paidOrders: 0,
          revenue: {},
          revenueTotal: "0.00",
        },
      ]),
    );
    // Une devise dont au moins une vente n'a pas de taux est exclue de TOUS les totaux de la réponse :
    // la courbe convertie reste comparable d'un jour à l'autre, et l'écart est signalé (missingRates).
    const missing = new Set(orders.rows.filter((row) => row.missing).map((row) => row.currency));
    const currencies = new Set<string>();
    for (const row of orders.rows) {
      const point = points.get(row.b);
      if (!point) continue;
      currencies.add(row.currency);
      point.paidOrders += row.n;
      point.revenue[row.currency] = row.amount;
      if (!missing.has(row.currency)) point.revenueTotal = addAmounts(point.revenueTotal, row.converted ?? "0");
    }

    return {
      interval: q.interval,
      tz: q.tz,
      referenceCurrency: ref,
      currencies: [...currencies].sort(),
      missingRates: [...missing].sort(),
      points: [...points.values()],
    };
  }

  // ------------------------------------------------------------------
  // Géographie : pays et continents
  // ------------------------------------------------------------------

  async geo(range: InsightsRange): Promise<AdminGeoResponse> {
    const ref = await this.referenceCurrency();
    const [accounts, sales] = await Promise.all([
      sql<{ code: string | null; users: number; new_users: number }>`
        select country_code as code, count(*)::int as users,
               (count(*) filter (where ${within(sql`created_at`, range)}))::int as new_users
          from app.profiles where deleted_at is null group by 1`.execute(this.db),
      sql<{ code: string | null; orders: number; currency: string; converted: string | null; missing: boolean }>`
        with paid as (${this.paid(ref, range)})
        select country_code as code, count(*)::int as orders, currency,
               round(sum(converted), 2)::text as converted, bool_or(converted is null) as missing
          from paid group by 1, 3`.execute(this.db),
    ]);

    const missing = new Set(sales.rows.filter((row) => row.missing).map((row) => row.currency));
    const byCountry = new Map<string, GeoRow>();
    const unknown = emptyGeo();
    const row = (code: string | null) => {
      if (!code || !continentOf(code)) return unknown;
      let entry = byCountry.get(code);
      if (!entry) byCountry.set(code, (entry = emptyGeo()));
      return entry;
    };
    for (const a of accounts.rows) {
      const entry = row(a.code);
      entry.users += a.users;
      entry.newUsers += a.new_users;
    }
    // Payeurs distincts par pays : une même personne peut payer en deux devises ; on compte les payeurs par pays à part.
    const { rows: payers } = await sql<{ code: string | null; paying: number }>`
      with paid as (${this.paid(ref, range)})
      select country_code as code, count(distinct user_id)::int as paying from paid group by 1`.execute(this.db);
    for (const p of payers) row(p.code).payingUsers += p.paying;
    for (const s of sales.rows) {
      const entry = row(s.code);
      entry.paidOrders += s.orders;
      if (!missing.has(s.currency)) entry.revenueTotal = addAmounts(entry.revenueTotal, s.converted ?? "0");
    }

    const countries = [...byCountry.entries()]
      .map(([code, values]) => ({ code, continent: continentOf(code)!, ...values }))
      .sort((a, b) => b.users - a.users || a.code.localeCompare(b.code));
    const continents = CONTINENTS.map((continent: Continent) => {
      const total = emptyGeo();
      for (const country of countries.filter((x) => x.continent === continent)) {
        total.users += country.users;
        total.newUsers += country.newUsers;
        total.payingUsers += country.payingUsers;
        total.paidOrders += country.paidOrders;
        total.revenueTotal = addAmounts(total.revenueTotal, country.revenueTotal);
      }
      return { continent, ...total };
    });

    return { range, referenceCurrency: ref, missingRates: [...missing].sort(), countries, continents, unknown };
  }

  // ------------------------------------------------------------------
  // Abonnements (licences)
  // ------------------------------------------------------------------

  async subscriptions(): Promise<AdminSubscriptionsResponse> {
    const [byPlan, bySource, expiring] = await Promise.all([
      sql<{ code: string; name: string; is_free: boolean; status: keyof LicenseStatusCounts; n: number }>`
        select p.code, p.name, p.is_free, l.status::text as status, count(l.id)::int as n
          from app.plans p
          left join app.licenses l on l.plan_id = p.id
         group by p.code, p.name, p.is_free, p.position, l.status
         order by p.position, p.code`.execute(this.db),
      sql<{ source: AdminSubscriptionsResponse["bySource"][number]["source"]; n: number }>`
        select source::text as source, count(*)::int as n from app.licenses
         where status = 'active' and (ends_at is null or ends_at > now()) group by 1 order by 2 desc`.execute(this.db),
      this.db
        .selectFrom("app.licenses as l")
        .innerJoin("app.plans as p", "p.id", "l.plan_id")
        .select(["l.id", "l.user_id", "l.ends_at", "p.code", "p.name"])
        .where("l.status", "=", "active")
        .where("l.ends_at", ">", sql<Date>`now()`)
        .where("l.ends_at", "<=", sql<Date>`now() + interval '30 days'`)
        .orderBy("l.ends_at")
        .limit(50)
        .execute(),
    ]);

    const plans = new Map<string, AdminSubscriptionsResponse["byPlan"][number]>();
    for (const r of byPlan.rows) {
      let plan = plans.get(r.code);
      if (!plan) {
        plan = { planCode: r.code, planName: r.name, isFree: r.is_free, pending: 0, active: 0, expired: 0, revoked: 0, refunded: 0 };
        plans.set(r.code, plan);
      }
      if (r.status) plan[r.status] += r.n;
    }

    return {
      activeTotal: bySource.rows.reduce((n, r) => n + r.n, 0),
      byPlan: [...plans.values()],
      bySource: bySource.rows.map((r) => ({ source: r.source, active: r.n })),
      expiringSoon: expiring.map((l) => ({ licenseId: l.id, userId: l.user_id, planCode: l.code, planName: l.name, endsAt: toIso(l.ends_at)! })),
    };
  }

  // ------------------------------------------------------------------
  // Calendrier d'un mois
  // ------------------------------------------------------------------

  async calendar(month: string, tz: string): Promise<AdminCalendarResponse> {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const from = `${month}-01`;
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const range: InsightsRange = { from, to, tz };
    const ref = await this.referenceCurrency();

    const [series, expirations, rates, prices] = await Promise.all([
      this.timeseries({ ...range, interval: "day" }),
      sql<{ d: string; code: string; n: number }>`
        select ${localDay(sql`l.ends_at`, tz)}::text as d, p.code, count(*)::int as n
          from app.licenses l join app.plans p on p.id = l.plan_id
         where l.status in ('active', 'expired') and ${within(sql`l.ends_at`, range)}
         group by 1, 2 order by 1, 2`.execute(this.db),
      sql<{ d: string; currency: string; n: number }>`
        select valid_from::text as d, currency, count(*)::int as n from app.exchange_rates
         where reference_currency = ${ref} and valid_from between cast(${from} as date) and cast(${to} as date)
         group by 1, 2 order by 1, 2`.execute(this.db),
      sql<{ d: string; subject: string; n: number }>`
        select ${localDay(sql`pp.valid_from`, tz)}::text as d, p.code || ' · ' || pp.currency as subject, count(*)::int as n
          from app.plan_prices pp join app.plans p on p.id = pp.plan_id
         where ${within(sql`pp.valid_from`, range)}
         group by 1, 2 order by 1, 2`.execute(this.db),
    ]);

    const expiriesByDay = new Map<string, number>();
    for (const e of expirations.rows) expiriesByDay.set(e.d, (expiriesByDay.get(e.d) ?? 0) + e.n);

    const events: CalendarEvent[] = [
      ...expirations.rows.map((e) => ({ date: e.d, kind: "license_expirations" as const, subject: e.code, count: e.n })),
      ...rates.rows.map((r) => ({ date: r.d, kind: "exchange_rate" as const, subject: r.currency, count: r.n })),
      ...prices.rows.map((p) => ({ date: p.d, kind: "plan_price" as const, subject: p.subject, count: p.n })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return {
      month,
      tz,
      referenceCurrency: series.referenceCurrency,
      missingRates: series.missingRates,
      days: series.points.map((p) => ({
        date: p.date,
        signups: p.signups,
        publications: p.publications,
        newSubscriptions: p.newSubscriptions,
        paidOrders: p.paidOrders,
        revenueTotal: p.revenueTotal,
        licenseExpirations: expiriesByDay.get(p.date) ?? 0,
      })),
      events,
    };
  }
}

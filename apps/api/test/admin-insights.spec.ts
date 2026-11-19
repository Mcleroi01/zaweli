/**
 * Statistiques de l'administration : l'API réelle contre les migrations
 * réelles (PGlite). Les données sont posées directement en base, à des dates
 * fixes, pour que chaque chiffre attendu se vérifie à la main.
 *
 * Jeu de données (octobre 2026, fuseau Africa/Kinshasa = UTC+1) :
 *  - comptes : 2 en RDC (CD), 1 en France (FR), 1 sans pays, + l'administrateur ;
 *  - ventes payées : 10 USD (CD, le 2), 20 USD (FR, le 2), 50 000 CDF (CD, le 3),
 *    15 EUR (FR, le 3, sans taux saisi), 99 USD remboursée (exclue) ;
 *  - une vente à 23 h 30 UTC le 4 : le 5 à Kinshasa.
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JwtVerifierService } from "../src/auth/jwt-verifier.service.js";
import { DB } from "../src/database/database.module.js";
import { createTestDatabase } from "./support/pglite.js";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.PUBLIC_WEB_URL = "https://zaweli.test";

let app: INestApplication;
let pg: PGlite;
let admin: string;
let user: string;
const http = () => request(app.getHttpServer());
const as = (id: string) => ({ authorization: `Bearer test:${id}` });
const TZ = "Africa/Kinshasa";
const OCTOBER = { from: "2026-10-01", to: "2026-10-31", tz: TZ };

async function account(country: string | null, createdAt: string) {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, `${id}@zaweli.test`]);
  await pg.query("insert into app.profiles (id) values ($1) on conflict (id) do nothing", [id]);
  await pg.query("update app.profiles set created_at = $2, country_code = $3, country_source = $4 where id = $1", [
    id,
    createdAt,
    country,
    country ? "declared" : null,
  ]);
  return id;
}

/** Commande payée (le déclencheur exige l'acteur « prestataire », comme un webhook vérifié). */
async function paidOrder(userId: string, amount: string, currency: string, paidAt: string, status: "paid" | "refunded" = "paid", country: string | null = null) {
  const price = await pg.query<{ id: string; plan_id: string }>(
    "select pp.id, pp.plan_id from app.plan_prices pp join app.plans p on p.id = pp.plan_id where p.code = 'SOLO' limit 1",
  );
  await pg.exec("begin");
  await pg.query("select set_config('app.actor', 'provider', true)");
  await pg.query(
    `insert into app.orders (user_id, plan_id, plan_price_id, amount, currency, status, idempotency_key, provider, paid_at, created_at, country_code)
     values ($1, $2, $3, $4, $5, $6, $7, 'mbiyopay', $8, $8, $9)`,
    [userId, price.rows[0]!.plan_id, price.rows[0]!.id, amount, currency, status, `key-${randomUUID()}`, paidAt, country],
  );
  await pg.exec("commit");
}

beforeAll(async () => {
  const database = await createTestDatabase();
  pg = database.pg;

  await pg.query(`insert into app.plans (code, name, is_free, is_active, is_public, publications_max, template_access_mode, edit_policy, edit_days)
                  values ('FREE', 'Gratuit', true, true, true, 1, 'all', 'days', 7)`);
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, template_access_mode)
                  values ('SOLO', 'Solo', true, true, 7, 'all')`);
  await pg.query("insert into app.plan_prices (plan_id, currency, amount) select id, 'USD', 5 from app.plans where code = 'SOLO'");

  admin = await account(null, "2026-09-01T10:00:00Z");
  await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
  user = await account("CD", "2026-10-02T09:00:00Z");
  const kinoise = await account("CD", "2026-10-15T09:00:00Z");
  const parisienne = await account("FR", "2026-10-02T12:00:00Z");
  await account(null, "2026-10-20T08:00:00Z");

  await paidOrder(user, "10.00", "USD", "2026-10-02T10:00:00Z");
  await paidOrder(parisienne, "20.00", "USD", "2026-10-02T14:00:00Z");
  await paidOrder(kinoise, "50000.00", "CDF", "2026-10-03T10:00:00Z");
  await paidOrder(parisienne, "15.00", "EUR", "2026-10-03T11:00:00Z");
  await paidOrder(user, "99.00", "USD", "2026-10-03T12:00:00Z", "refunded");
  // 23 h 30 UTC le 4 = 0 h 30 le 5 à Kinshasa. Pays figé sur la commande : vendue au Kenya.
  await paidOrder(kinoise, "5.00", "USD", "2026-10-04T23:30:00Z", "paid", "KE");

  // Licences : un droit gratuit, puis un achat (conversion), un abonnement qui expire bientôt.
  await pg.query(
    `insert into app.licenses (user_id, plan_id, source, status, starts_at, ends_at, start_policy, template_access_mode, edit_policy, edit_days,
                               max_publications_per_day, ai_generations_max, created_at)
     select $1, id, 'free', 'active', now(), null, 'immediate', 'all', 'days', 7, max_publications_per_day, ai_generations_max, '2026-10-02T09:30:00Z'
       from app.plans where code = 'FREE'`,
    [user],
  );
  await pg.query(
    `insert into app.licenses (user_id, plan_id, source, status, starts_at, ends_at, start_policy, template_access_mode, edit_policy,
                               max_publications_per_day, ai_generations_max, created_at)
     select $1, id, 'admin_grant', 'active', now(), now() + interval '3 days', 'immediate', 'all', 'while_valid',
            max_publications_per_day, ai_generations_max, '2026-10-10T09:00:00Z'
       from app.plans where code = 'SOLO'`,
    [parisienne],
  );

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(database.db)
    .overrideProvider(JwtVerifierService)
    .useValue({
      verify: async (token: string) => {
        const [scheme, id] = token.split(":");
        if (scheme !== "test" || !id) throw new Error("jeton de test invalide");
        return { id, email: `${id}@zaweli.test` };
      },
    })
    .compile();
  app = configureApp(moduleRef.createNestApplication());
  await app.init();
  // Migrations sur PostgreSQL embarqué : plus long quand plusieurs suites tournent en parallèle.
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe("Statistiques d'administration", () => {
  it("sont réservées au rôle admin lu en base", async () => {
    await http().get("/v1/admin/insights/overview").query(OCTOBER).expect(401);
    await http().get("/v1/admin/insights/overview").set(as(user)).query(OCTOBER).expect(403);
    await http().get("/v1/admin/audit").set(as(user)).expect(403);
  });

  it("refusent une période invalide", async () => {
    await http().get("/v1/admin/insights/overview").set(as(admin)).query({ from: "2026-10-31", to: "2026-10-01" }).expect(400);
    await http().get("/v1/admin/insights/overview").set(as(admin)).query({ ...OCTOBER, tz: "Mars/Olympus" }).expect(400);
    await http().get("/v1/admin/insights/overview").set(as(admin)).query({ from: "2025-01-01", to: "2026-10-01" }).expect(400);
  });

  it("vue d'ensemble : comptes, ventes par devise, conversion, sans taux inventé", async () => {
    const res = await http().get("/v1/admin/insights/overview").set(as(admin)).query(OCTOBER).expect(200);
    const o = res.body;
    expect(o.users).toEqual({ total: 5, new: 4, previousNew: 1, withCountry: 3 });
    expect(o.orders.paid).toBe(5);
    expect(o.revenue.byCurrency).toEqual([
      { currency: "CDF", amount: "50000.00" },
      { currency: "EUR", amount: "15.00" },
      { currency: "USD", amount: "35.00" },
    ]);
    // Aucun taux saisi : seuls les USD (devise de référence) sont additionnés.
    expect(o.revenue.total).toEqual({ currency: "USD", amount: "35.00", missingRates: ["CDF", "EUR"] });
    expect(o.conversion).toEqual({ freeUsers: 1, convertedUsers: 1 });
    expect(o.subscriptions.active).toBe(1);
    expect(o.payingUsers).toBe(3);
  });

  it("taux de change : saisis, datés, journalisés, et appliqués au jour du paiement", async () => {
    await http().post("/v1/admin/exchange-rates").set(as(user)).send({ currency: "CDF", rate: "0.0004", validFrom: "2026-10-01" }).expect(403);
    await http().post("/v1/admin/exchange-rates").set(as(admin)).send({ currency: "USD", rate: "1", validFrom: "2026-10-01" }).expect(400);
    await http().post("/v1/admin/exchange-rates").set(as(admin)).send({ currency: "CDF", rate: "-1", validFrom: "2026-10-01" }).expect(400);
    // Taux en vigueur à partir du 4 seulement : la vente du 3 n'a pas de taux ce jour-là.
    await http().post("/v1/admin/exchange-rates").set(as(admin)).send({ currency: "CDF", rate: "0.0004", validFrom: "2026-10-04" }).expect(201);
    let o = (await http().get("/v1/admin/insights/overview").set(as(admin)).query(OCTOBER).expect(200)).body;
    expect(o.revenue.total).toEqual({ currency: "USD", amount: "35.00", missingRates: ["CDF", "EUR"] });

    await http().post("/v1/admin/exchange-rates").set(as(admin)).send({ currency: "CDF", rate: "0.0005", validFrom: "2026-10-01" }).expect(201);
    await http().post("/v1/admin/exchange-rates").set(as(admin)).send({ currency: "CDF", rate: "0.0005", validFrom: "2026-10-01" }).expect(409);
    o = (await http().get("/v1/admin/insights/overview").set(as(admin)).query(OCTOBER).expect(200)).body;
    // 50 000 CDF × 0,0005 (taux du 1er, le plus récent en vigueur le 3) = 25 USD.
    expect(o.revenue.total).toEqual({ currency: "USD", amount: "60.00", missingRates: ["EUR"] });

    const rates = (await http().get("/v1/admin/exchange-rates").set(as(admin)).expect(200)).body;
    expect(rates.referenceCurrency).toBe("USD");
    expect(rates.rates.map((r: { validFrom: string; rate: string }) => [r.validFrom, Number(r.rate)])).toEqual([
      ["2026-10-04", 0.0004],
      ["2026-10-01", 0.0005],
    ]);
    await expect(pg.query("update app.exchange_rates set rate = 1")).rejects.toThrow(/APPEND_ONLY/);
  });

  it("série par jour dans le fuseau demandé (une vente à 23 h 30 UTC compte le lendemain à Kinshasa)", async () => {
    const res = await http()
      .get("/v1/admin/insights/timeseries")
      .set(as(admin))
      .query({ from: "2026-10-01", to: "2026-10-06", tz: TZ, interval: "day" })
      .expect(200);
    const byDay = Object.fromEntries(res.body.points.map((p: { date: string }) => [p.date, p]));
    expect(res.body.points).toHaveLength(6);
    expect(byDay["2026-10-02"]).toMatchObject({ signups: 2, paidOrders: 2, revenue: { USD: "30.00" }, revenueTotal: "30.00" });
    expect(byDay["2026-10-03"]).toMatchObject({ paidOrders: 2, revenue: { CDF: "50000.00", EUR: "15.00" }, revenueTotal: "25.00" });
    expect(byDay["2026-10-04"].paidOrders).toBe(0);
    expect(byDay["2026-10-05"]).toMatchObject({ paidOrders: 1, revenueTotal: "5.00" });
    expect(res.body.missingRates).toEqual(["EUR"]);

    const utc = await http()
      .get("/v1/admin/insights/timeseries")
      .set(as(admin))
      .query({ from: "2026-10-01", to: "2026-10-06", tz: "UTC" })
      .expect(200);
    expect(utc.body.points.find((p: { date: string }) => p.date === "2026-10-04").paidOrders).toBe(1);

    const months = await http()
      .get("/v1/admin/insights/timeseries")
      .set(as(admin))
      .query({ from: "2026-09-01", to: "2026-10-31", tz: TZ, interval: "month" })
      .expect(200);
    expect(months.body.points.map((p: { date: string; signups: number }) => [p.date, p.signups])).toEqual([
      ["2026-09-01", 1],
      ["2026-10-01", 4],
    ]);
  });

  it("géographie : par pays (pays figé sur la commande) et par continent", async () => {
    const res = await http().get("/v1/admin/insights/geo").set(as(admin)).query(OCTOBER).expect(200);
    const country = (code: string) => res.body.countries.find((c: { code: string }) => c.code === code);
    expect(country("CD")).toMatchObject({ continent: "africa", users: 2, newUsers: 2, payingUsers: 2, paidOrders: 2, revenueTotal: "35.00" });
    expect(country("FR")).toMatchObject({ continent: "europe", users: 1, paidOrders: 2, revenueTotal: "20.00" });
    // Vente au Kenya : un pays sans compte apparaît grâce à la commande.
    expect(country("KE")).toMatchObject({ continent: "africa", users: 0, paidOrders: 1, revenueTotal: "5.00" });
    const africa = res.body.continents.find((c: { continent: string }) => c.continent === "africa");
    expect(africa).toMatchObject({ users: 2, paidOrders: 3, revenueTotal: "40.00" });
    expect(res.body.unknown.users).toBe(2);
    expect(res.body.missingRates).toEqual(["EUR"]);
  });

  it("abonnements et calendrier du mois", async () => {
    const subs = (await http().get("/v1/admin/insights/subscriptions").set(as(admin)).expect(200)).body;
    expect(subs.activeTotal).toBe(2);
    expect(subs.byPlan.find((p: { planCode: string }) => p.planCode === "SOLO")).toMatchObject({ active: 1, isFree: false });
    expect(subs.expiringSoon).toHaveLength(1);
    expect(subs.expiringSoon[0].planCode).toBe("SOLO");

    const cal = (await http().get("/v1/admin/insights/calendar").set(as(admin)).query({ month: "2026-10", tz: TZ }).expect(200)).body;
    expect(cal.days).toHaveLength(31);
    expect(cal.days[1]).toMatchObject({ date: "2026-10-02", signups: 2, paidOrders: 2 });
    expect(cal.events).toEqual(
      expect.arrayContaining([
        { date: "2026-10-01", kind: "exchange_rate", subject: "CDF", count: 1 },
        { date: "2026-10-04", kind: "exchange_rate", subject: "CDF", count: 1 },
      ]),
    );
    await http().get("/v1/admin/insights/calendar").set(as(admin)).query({ month: "2026-13" }).expect(400);
  });

  it("journal d'audit : filtres, pagination par curseur, valeurs des filtres", async () => {
    await http().put("/v1/admin/exchange-rates/reference").set(as(admin)).send({ currency: "EUR" }).expect(200);
    const first = (await http().get("/v1/admin/audit").set(as(admin)).query({ limit: 2 }).expect(200)).body;
    expect(first.items).toHaveLength(2);
    expect(first.items[0]).toMatchObject({ action: "settings.reference_currency_changed", actorType: "admin", data: { from: "USD", to: "EUR" } });
    expect(first.nextCursor).toBe(first.items[1].id);
    const next = (await http().get("/v1/admin/audit").set(as(admin)).query({ limit: 2, cursor: first.nextCursor }).expect(200)).body;
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeNull();

    const filtered = (await http().get("/v1/admin/audit").set(as(admin)).query({ action: "exchange_rate.created" }).expect(200)).body;
    expect(filtered.items).toHaveLength(2);
    const facets = (await http().get("/v1/admin/audit/facets").set(as(admin)).expect(200)).body;
    expect(facets.actions).toEqual(["exchange_rate.created", "settings.reference_currency_changed"]);

    // Nouvelle référence : les taux saisis vers USD ne s'appliquent plus, les USD deviennent « sans taux ».
    const o = (await http().get("/v1/admin/insights/overview").set(as(admin)).query(OCTOBER).expect(200)).body;
    expect(o.revenue.total).toEqual({ currency: "EUR", amount: "15.00", missingRates: ["CDF", "USD"] });
  });
});

describe("Pays du compte", () => {
  it("détecté par l'en-tête du CDN, puis remplacé par le pays déclaré", async () => {
    const id = await account(null, "2026-10-25T08:00:00Z");
    let profile = (await http().get("/v1/me/profile").set(as(id)).set("cf-ipcountry", "XX").expect(200)).body;
    expect(profile).toMatchObject({ countryCode: null, countrySource: null });
    profile = (await http().get("/v1/me/profile").set(as(id)).set("cf-ipcountry", "cd").expect(200)).body;
    expect(profile).toMatchObject({ countryCode: "CD", countrySource: "detected" });

    profile = (await http().patch("/v1/me/profile").set(as(id)).set("cf-ipcountry", "BE").send({ countryCode: "sn" }).expect(200)).body;
    expect(profile).toMatchObject({ countryCode: "SN", countrySource: "declared" });
    // La détection n'écrase jamais un pays existant.
    profile = (await http().get("/v1/me/profile").set(as(id)).set("cf-ipcountry", "BE").expect(200)).body;
    expect(profile.countryCode).toBe("SN");

    await http().patch("/v1/me/profile").set(as(id)).send({ countryCode: "ZZ" }).expect(400);
    profile = (await http().patch("/v1/me/profile").set(as(id)).set("cf-ipcountry", "BE").send({ countryCode: null }).expect(200)).body;
    expect(profile).toMatchObject({ countryCode: "BE", countrySource: "detected" });
  });
});

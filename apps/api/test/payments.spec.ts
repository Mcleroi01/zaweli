/**
 * Paiements mobile money (docs/12) : l'API réelle contre les migrations
 * réelles (PGlite), avec une FAUSSE passerelle MbiyoPay qui joue le rôle du
 * prestataire (statuts « pending », « successful », « failed », refus).
 *
 * Ce qui est vérifié avant tout : rien ne devient « payé » sans que la
 * transaction relue chez le prestataire le dise, et un webhook ne fait que
 * déclencher cette relecture.
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import { coffretV1 } from "@zaweli/template-coffret";
import { manifestHash } from "@zaweli/template-engine/schema";
import { ThrottlerStorage } from "@nestjs/throttler";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JwtVerifierService } from "../src/auth/jwt-verifier.service.js";
import type { Env } from "../src/config/env.js";
import { DB } from "../src/database/database.module.js";
import {
  type GatewayInitiation,
  GatewayRejected,
  type GatewayRequest,
  type GatewayStatus,
  type GatewayTransaction,
  htmlToText,
  MbiyoPayGateway,
  MobileMoneyGateway,
} from "../src/payments/mobile-money.gateway.js";
import { feeFor, parseRate } from "../src/payments/payments.service.js";
import { createTestDatabase } from "./support/pglite.js";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.PUBLIC_WEB_URL = "https://zaweli.test";
process.env.PUBLIC_API_URL = "https://api.zaweli.test";

/** Prestataire simulé : garde les transactions et laisse le test décider de leur sort. */
class FakeGateway extends MobileMoneyGateway {
  readonly mode = "sandbox" as const;
  readonly txs = new Map<string, GatewayTransaction>();
  readonly calls: Array<{ kind: "payin" | "payout"; request: GatewayRequest & { beneficiary?: string } }> = [];
  rejectNext: string | null = null;
  next: GatewayInitiation["next"] = { kind: "wait" };

  private start(kind: "payin" | "payout", r: GatewayRequest & { beneficiary?: string }): GatewayTransaction {
    this.calls.push({ kind, request: r });
    if (this.rejectNext) {
      const message = this.rejectNext;
      this.rejectNext = null;
      throw new GatewayRejected(message, 400);
    }
    const t: GatewayTransaction = {
      transactionId: `${kind === "payin" ? "CI" : "CO"}-${randomUUID().slice(0, 8)}`,
      orderId: r.orderId,
      status: "pending",
      amount: r.amount,
      fee: kind === "payin" ? 0 : 0.5,
      chargedAmount: r.amount,
      currency: r.currency,
      type: kind === "payin" ? "cashin" : "cashout",
    };
    this.txs.set(t.transactionId, t);
    return t;
  }

  async payin(r: GatewayRequest): Promise<GatewayInitiation> {
    return { ...this.start("payin", r), next: this.next };
  }
  async payout(r: GatewayRequest & { beneficiary: string; callbackUrl: string }): Promise<GatewayTransaction> {
    return this.start("payout", r);
  }
  async transaction(id: string): Promise<GatewayTransaction | null> {
    return this.txs.get(id) ?? [...this.txs.values()].find((t) => t.orderId === id) ?? null;
  }
  async finalize(): Promise<void> {}
  verifySignature(_raw: Buffer | undefined, _body: unknown, signature: string | undefined): boolean | null {
    return signature === "valid";
  }

  /** Le prestataire tranche (comme après la validation sur le téléphone). */
  settle(orderId: string, status: GatewayStatus, patch: Partial<GatewayTransaction> = {}) {
    const t = [...this.txs.values()].find((x) => x.orderId === orderId)!;
    Object.assign(t, { status, ...patch });
    return t;
  }
}

let app: INestApplication;
let pg: PGlite;
const gateway = new FakeGateway();
const http = () => request(app.getHttpServer());
const as = (userId: string) => ({ authorization: `Bearer test:${userId}` });
const payer = { countryCode: "CD", network: "vodacom", phoneNumber: "0970000000" };

async function createUser() {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, `${id}@zaweli.test`]);
  return id;
}

/** Webhook tel que MbiyoPay l'envoie (corps plat) ; la signature est jugée par la passerelle. */
const webhook = (t: GatewayTransaction, signature = "valid") =>
  http()
    .post("/v1/webhooks/mbiyopay")
    .set("signature", signature)
    .send({ transaction_id: t.transactionId, order_id: t.orderId, status: t.status, amount: t.amount, currency: t.currency, type: t.type })
    .expect(200);

async function readyPhotos(ownerId: string) {
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = randomUUID();
    await pg.query(
      `insert into app.media_assets (id, owner_id, status, upload_path, declared_mime, declared_size_bytes, detected_mime, width, height, published_variants)
       values ($1, $2, 'ready', $3, 'image/jpeg', 1000, 'image/webp', 900, 1200, $4)`,
      [id, ownerId, `uploads/${ownerId}/${id}`, JSON.stringify({ lg: `https://cdn.zaweli.test/${id}/lg.webp` })],
    );
    ids.push(id);
  }
  return ids;
}

async function draftWithMoneyGift(userId: string, amount: number, currency = "USD") {
  const photos = await readyPhotos(userId);
  const photo = (mediaId: string) => ({ mediaId, alt: "Une photo" });
  const recipient = await http().post("/v1/recipients").set(as(userId)).send({ displayName: "Pauline" }).expect(201);
  const created = await http().post("/v1/experiences").set(as(userId)).send({ templateSlug: "coffret", recipientId: recipient.body.id }).expect(201);
  const id = created.body.id as string;
  await http()
    .patch(`/v1/experiences/${id}`)
    .set(as(userId))
    .send({
      content: {
        fields: {
          name: "Pauline",
          sealCard: "Aujourd'hui, tout ce qui se trouve ici t'appartient.",
          sealCta: "Je suis prête",
          jewelTitle: "Un écrin pour toi",
          jewelPhoto: photo(photos[0]!),
          jewelReveal: "La plus belle, c'est toi.",
          riddles: [{ question: "Où nous sommes-nous rencontrés ?", choices: ["Kinshasa", "Paris", "Lubumbashi"], answer: 0, photo: photo(photos[1]!), reveal: "À Kinshasa, bien sûr." }],
          giftsTitle: "Tes cadeaux",
          celebrationPhoto: photo(photos[2]!),
          wishes: ["joie", "amour", "rires", "voyages", "santé", "paix", "audace", "douceur"],
          wishesDone: "Tous tes vœux sont lâchés.",
          finalePhoto: photo(photos[3]!),
          finaleLine: "Joyeux anniversaire.",
          finaleLetter: "Merci d'être exactement toi, chaque jour de l'année.",
          finaleSignoff: "Avec amour",
        },
        disabledSections: [],
      },
    })
    .expect(200);
  const gift = await http()
    .post(`/v1/experiences/${id}/gifts`)
    .set(as(userId))
    .send({ type: "MONEY", data: { amount, currency, receptionMode: "zaweli_transfer", message: "Pour ton voyage" } })
    .expect(201);
  return { experienceId: id, giftId: gift.body.id as string };
}

beforeAll(async () => {
  const database = await createTestDatabase();
  pg = database.pg;

  const category = await pg.query<{ id: string }>("select id from app.template_categories where slug = 'anniversaire'");
  const template = await pg.query<{ id: string }>(
    "insert into app.templates (slug, name, description, category_id, status) values ('coffret', 'Coffret', $1, $2, 'published') returning id",
    [coffretV1.description, category.rows[0]!.id],
  );
  const version = await pg.query<{ id: string }>(
    `insert into app.template_versions (template_id, version, renderer_key, manifest, manifest_hash, status, published_at)
     values ($1, '1.0.0', 'coffret@1.0.0', $2, $3, 'published', now()) returning id`,
    [template.rows[0]!.id, JSON.stringify(coffretV1), await manifestHash(coffretV1)],
  );
  await pg.query("update app.templates set current_version_id = $1 where id = $2", [version.rows[0]!.id, template.rows[0]!.id]);
  await pg.query("update app.app_settings set value = '50' where key = 'drafts.max_active'");
  await pg.query(`insert into app.plans (code, name, is_free, is_active, is_public, publications_max, template_access_mode, edit_policy, edit_days)
                  values ('FREE', 'Gratuit', true, true, true, 5, 'all', 'days', 7)`);
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, publications_max, template_access_mode)
                  values ('SOLO', 'Solo', true, true, 7, 1, 'all')`);
  await pg.query("insert into app.plan_prices (plan_id, currency, amount) select id, 'USD', 5 from app.plans where code = 'SOLO'");
  await pg.query("insert into app.plan_prices (plan_id, currency, amount) select id, 'CDF', 14000 from app.plans where code = 'SOLO'");
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, publications_max, recipients_max, template_access_mode)
                  values ('MULTI_USE', 'Multi', true, true, 90, 10, 3, 'all')`);
  await pg.query("insert into app.plan_prices (plan_id, currency, amount) select id, 'USD', 12 from app.plans where code = 'MULTI_USE'");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(database.db)
    .overrideProvider(MobileMoneyGateway)
    .useValue(gateway)
    // Ces tests enchaînent des dizaines de commandes depuis la même adresse : la limite de débit est testée ailleurs.
    .overrideProvider(ThrottlerStorage)
    .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60_000, isBlocked: false, timeToBlockExpire: 0 }) })
    .overrideProvider(JwtVerifierService)
    .useValue({
      verify: async (token: string) => {
        const [scheme, id] = token.split(":");
        if (scheme !== "test" || !id) throw new Error("jeton de test invalide");
        return { id, email: `${id}@zaweli.test` };
      },
    })
    .compile();
  app = configureApp(moduleRef.createNestApplication({ rawBody: true }));
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pg?.close();
});

beforeEach(() => {
  gateway.rejectNext = null;
  gateway.next = { kind: "wait" };
});

describe("Montants et frais", () => {
  it("calcule les frais au centime supérieur, à l'unité pour les devises sans centimes", () => {
    const rate = parseRate("0.05")!;
    expect(feeFor("20.00", "USD", rate)).toBe("1.00");
    expect(feeFor("10.01", "USD", rate)).toBe("0.51");
    expect(feeFor("10001.00", "CDF", rate)).toBe("501.00");
    expect(parseRate(null)).toBeNull();
    expect(parseRate("1.5")).toBeNull();
    expect(parseRate(0.035)?.text).toBe("0.035");
  });

  it("ne garde que le texte des consignes HTML du réseau", () => {
    expect(htmlToText("<p>Composez <b>*144#</b></p><script>x</script>")).toBe("Composez *144#\nx");
  });
});

describe("Signature des webhooks MbiyoPay", () => {
  it("vérifie le HMAC-SHA256 du corps brut avec le secret", async () => {
    const { createHmac } = await import("node:crypto");
    const real = new MbiyoPayGateway({ MBIYOPAY_API_KEY: "test_key_123456", MBIYOPAY_MODE: "sandbox", MBIYOPAY_WEBHOOK_SECRET: "secret-123" } as Env);
    const raw = Buffer.from('{"transaction_id":"CI-1","status":"successful"}');
    const good = createHmac("sha256", "secret-123").update(raw).digest("hex");
    expect(real.verifySignature(raw, JSON.parse(raw.toString()), good)).toBe(true);
    expect(real.verifySignature(raw, JSON.parse(raw.toString()), "0".repeat(64))).toBe(false);
    expect(real.verifySignature(raw, {}, undefined)).toBe(false);
    expect(new MbiyoPayGateway({ MBIYOPAY_MODE: "sandbox" } as Env).mode).toBe("disabled");
  });
});

describe("Achat d'une formule", () => {
  it("active la licence seulement quand le prestataire confirme le paiement", async () => {
    const user = await createUser();
    const options = await http().get("/v1/payments/options").set(as(user)).expect(200);
    expect(options.body.mode).toBe("sandbox");
    expect(options.body.countries.find((c: { code: string }) => c.code === "CD").currencies.map((c: { code: string }) => c.code)).toEqual(["USD", "CDF"]);

    const created = await http().post("/v1/orders").set(as(user)).set("idempotency-key", `buy-${randomUUID()}`).send({ planCode: "SOLO", currency: "USD", payer }).expect(201);
    expect(created.body).toMatchObject({ status: "pending", amount: "5.00", currency: "USD", plan: { code: "SOLO" }, next: { kind: "wait" } });
    // Le serveur fixe le montant et le numéro au format international.
    expect(gateway.calls.at(-1)!.request).toMatchObject({ amount: 5, currency: "USD", phoneNumber: "243970000000", network: "vodacom", countryCode: "CD" });
    expect(gateway.calls.at(-1)!.request.callbackUrl).toBe("https://api.zaweli.test/v1/webhooks/mbiyopay");

    // Un webhook qui ment (« successful ») sans que le prestataire le confirme : rien ne change.
    const pending = [...gateway.txs.values()].at(-1)!;
    await http()
      .post("/v1/webhooks/mbiyopay")
      .set("signature", "faux")
      .send({ transaction_id: pending.transactionId, status: "successful", amount: 5, currency: "USD" })
      .expect(200);
    const still = await http().get(`/v1/orders/${created.body.id}`).set(as(user)).expect(200);
    expect(still.body.status).toBe("pending");
    expect((await pg.query("select count(*)::int as n from app.licenses where user_id = $1 and source = 'purchase'", [user])).rows[0]).toEqual({ n: 0 });

    // Le prestataire confirme, puis son webhook arrive.
    await webhook(gateway.settle(created.body.id, "successful", { fee: 0.08 }));
    const paid = await http().get(`/v1/orders/${created.body.id}`).set(as(user)).expect(200);
    expect(paid.body).toMatchObject({ status: "paid", next: null });
    expect(paid.body.licenseId).toEqual(expect.any(String));
    const license = await pg.query<{ status: string; source: string }>("select status, source from app.licenses where id = $1", [paid.body.licenseId]);
    expect(license.rows[0]).toEqual({ status: "active", source: "purchase" });

    // Le même webhook renvoyé n'active rien de plus.
    await webhook(gateway.settle(created.body.id, "successful"));
    expect((await pg.query("select count(*)::int as n from app.licenses where order_id = $1", [created.body.id])).rows[0]).toEqual({ n: 1 });
    const audit = await pg.query("select action from app.audit_log where entity_id = $1 order by id", [created.body.id]);
    expect(audit.rows.map((r) => (r as { action: string }).action)).toEqual(["order.created", "order.paid"]);

    const list = await http().get("/v1/orders").set(as(user)).expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejoue la même commande pour la même clé d'idempotence", async () => {
    const user = await createUser();
    const key = `same-${randomUUID()}`;
    const a = await http().post("/v1/orders").set(as(user)).set("idempotency-key", key).send({ planCode: "SOLO", currency: "CDF", payer }).expect(201);
    const b = await http().post("/v1/orders").set(as(user)).set("idempotency-key", key).send({ planCode: "SOLO", currency: "CDF", payer }).expect(201);
    expect(b.body.id).toBe(a.body.id);
    expect(a.body.amount).toBe("14000.00");
  });

  it("marque la commande échouée quand le réseau refuse ou échoue", async () => {
    const user = await createUser();
    gateway.rejectNext = "Payin is temporarily disabled for vodacom";
    const refused = await http().post("/v1/orders").set(as(user)).send({ planCode: "SOLO", currency: "USD", payer }).expect(422);
    expect(refused.body.error).toMatchObject({ code: "PAYMENT_REJECTED", details: { reason: "Payin is temporarily disabled for vodacom" } });

    const created = await http().post("/v1/orders").set(as(user)).send({ planCode: "SOLO", currency: "USD", payer }).expect(201);
    await webhook(gateway.settle(created.body.id, "failed"));
    const failed = await http().get(`/v1/orders/${created.body.id}`).set(as(user)).expect(200);
    expect(failed.body).toMatchObject({ status: "failed", licenseId: null });
  });

  it("refuse une devise, un pays ou un réseau que le mobile money ne prend pas", async () => {
    const user = await createUser();
    const xof = await http().post("/v1/orders").set(as(user)).send({ planCode: "SOLO", currency: "USD", payer: { countryCode: "BF", network: "orange", phoneNumber: "70123456" } }).expect(422);
    expect(xof.body.error.code).toBe("MOBILE_MONEY_CURRENCY_UNSUPPORTED");
    await http().post("/v1/orders").set(as(user)).send({ planCode: "SOLO", currency: "USD", payer: { ...payer, network: "mtn" } }).expect(400);
    await http().post("/v1/orders").set(as(user)).send({ planCode: "SOLO", currency: "EUR", payer }).expect(404);
    await http().post("/v1/orders").set(as(user)).send({ planCode: "FREE", currency: "USD", payer }).expect(404);
  });

  it("n'accorde pas de licence si le montant reçu est inférieur au prix", async () => {
    const user = await createUser();
    const created = await http().post("/v1/orders").set(as(user)).send({ planCode: "SOLO", currency: "USD", payer }).expect(201);
    await webhook(gateway.settle(created.body.id, "successful", { amount: 1 }));
    const order = await http().get(`/v1/orders/${created.body.id}`).set(as(user)).expect(200);
    expect(order.body).toMatchObject({ status: "disputed", licenseId: null });
  });
});

describe("Cadeau d'argent versé via ZAWELI", () => {
  it("reste impossible tant que les transferts sont fermés", async () => {
    const user = await createUser();
    const res = await http()
      .post("/v1/recipients")
      .set(as(user))
      .send({ displayName: "Test" })
      .expect(201);
    expect(res.body.id).toBeTruthy();
    const options = await http().get("/v1/payments/options").set(as(user)).expect(200);
    expect(options.body.moneyTransfers).toEqual({ enabled: false, feeRate: null });
  });

  it("de l'expéditeur au mobile money du destinataire, chaque étape confirmée par le prestataire", async () => {
    await pg.query("update app.app_settings set value = 'true' where key = 'gifts.money_transfers_enabled'");
    const user = await createUser();
    const { experienceId, giftId } = await draftWithMoneyGift(user, 20);

    // Frais non réglés : aucun paiement possible (rien n'est inventé).
    await http().post(`/v1/experiences/${experienceId}/gifts/${giftId}/funding`).set(as(user)).send({ payer }).expect(503);
    await pg.query(`update app.app_settings set value = '"0.05"' where key = 'payments.money_fee_rate'`);

    // Pas de publication tant que l'argent n'est pas versé.
    const blocked = await http().post(`/v1/experiences/${experienceId}/publish`).set(as(user)).send({ useFree: true }).expect(422);
    expect(blocked.body.error.code).toBe("EXPERIENCE_CONTENT_INVALID");

    const quote = await http().get(`/v1/experiences/${experienceId}/gifts/${giftId}/funding`).set(as(user)).expect(200);
    expect(quote.body).toMatchObject({ giftStatus: "AWAITING_FUNDING", amount: "20.00", fee: "1.00", total: "21.00", currency: "USD", transfer: null });

    gateway.next = { kind: "redirect", url: "https://pay.wave.com/c/test" };
    const started = await http().post(`/v1/experiences/${experienceId}/gifts/${giftId}/funding`).set(as(user)).send({ payer }).expect(200);
    expect(started.body.transfer).toMatchObject({ status: "pending", next: { kind: "redirect", url: "https://pay.wave.com/c/test" } });
    expect(gateway.calls.at(-1)!.request).toMatchObject({ amount: 21, currency: "USD" });
    // Un second clic ne déclenche pas un second paiement.
    const calls = gateway.calls.length;
    await http().post(`/v1/experiences/${experienceId}/gifts/${giftId}/funding`).set(as(user)).send({ payer }).expect(200);
    expect(gateway.calls.length).toBe(calls);

    await webhook(gateway.settle(started.body.transfer.id, "successful"));
    const funded = await http().get(`/v1/experiences/${experienceId}/gifts/${giftId}/funding`).set(as(user)).expect(200);
    expect(funded.body).toMatchObject({ giftStatus: "AWAITING_CLAIM", transfer: { status: "succeeded", next: null } });

    // Payé : ni modifiable ni supprimable.
    const locked = await http()
      .patch(`/v1/experiences/${experienceId}/gifts/${giftId}`)
      .set(as(user))
      .send({ data: { amount: 5, currency: "USD", receptionMode: "zaweli_transfer" } })
      .expect(409);
    expect(locked.body.error.code).toBe("GIFT_LOCKED");
    await http().delete(`/v1/experiences/${experienceId}/gifts/${giftId}`).set(as(user)).expect(409);

    const published = await http().post(`/v1/experiences/${experienceId}/publish`).set(as(user)).send({ useFree: true });
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    const slug = published.body.slug as string;

    // Le destinataire, sans compte.
    const info = await http().get(`/v1/public/experiences/${slug}/gifts/${giftId}/claim`).expect(200);
    expect(info.body).toMatchObject({ amount: "20.00", currency: "USD", state: "claimable", lastAttemptFailed: false });
    expect(info.body.countries.map((c: { code: string }) => c.code)).toEqual(["CD", "ZM"]);

    // Premier essai : le réseau refuse → le destinataire peut réessayer.
    gateway.rejectNext = "Invalid phone number";
    const account = { countryCode: "CD", network: "airtel", phoneNumber: "+243 971 111 111" };
    await http().post(`/v1/public/experiences/${slug}/gifts/${giftId}/claim`).send({ beneficiary: "Pauline K.", account }).expect(422);
    const retry = await http().get(`/v1/public/experiences/${slug}/gifts/${giftId}/claim`).expect(200);
    expect(retry.body).toMatchObject({ state: "claimable", lastAttemptFailed: true });

    const sending = await http().post(`/v1/public/experiences/${slug}/gifts/${giftId}/claim`).send({ beneficiary: "Pauline K.", account }).expect(200);
    expect(sending.body.state).toBe("pending");
    const payout = gateway.calls.at(-1)!;
    expect(payout).toMatchObject({ kind: "payout", request: { amount: 20, currency: "USD", phoneNumber: "243971111111", beneficiary: "Pauline K." } });
    // Pendant l'envoi, aucun second envoi.
    await http().post(`/v1/public/experiences/${slug}/gifts/${giftId}/claim`).send({ beneficiary: "Pauline K.", account }).expect(409);

    await webhook(gateway.settle(payout.request.orderId, "successful"));
    const done = await http().get(`/v1/public/experiences/${slug}/gifts/${giftId}/claim`).expect(200);
    expect(done.body.state).toBe("transferred");
    const page = await http().get(`/v1/public/experiences/${slug}`).expect(200);
    expect(JSON.stringify(page.body.payload)).toContain('"status":"TRANSFERRED"');

    // Le numéro complet n'est jamais conservé.
    const stored = await pg.query<{ phone_last4: string }>("select phone_last4 from app.gift_transfers where gift_id = $1 order by created_at", [giftId]);
    expect(stored.rows.map((r) => r.phone_last4)).toEqual(["0000", "1111", "1111"]);
    const history = await pg.query<{ to_status: string; actor: string }>("select to_status, actor from app.gift_status_history where gift_id = $1 order by id", [giftId]);
    expect(history.rows).toEqual([
      { to_status: "AWAITING_FUNDING", actor: "user" },
      { to_status: "FUNDED", actor: "provider" },
      { to_status: "AWAITING_CLAIM", actor: "system" },
      { to_status: "TRANSFER_PENDING", actor: "system" },
      { to_status: "FAILED", actor: "provider" },
      { to_status: "TRANSFER_PENDING", actor: "system" },
      { to_status: "TRANSFERRED", actor: "provider" },
    ]);
  });

  it("refuse la réception d'un cadeau d'une autre expérience ou pas encore payé", async () => {
    const user = await createUser();
    const { experienceId, giftId } = await draftWithMoneyGift(user, 10);
    await http().get(`/v1/public/experiences/AbCdEfGhIjKl/gifts/${giftId}/claim`).expect(404);
    // Revenir à une promesse tant que rien n'est payé.
    const back = await http()
      .patch(`/v1/experiences/${experienceId}/gifts/${giftId}`)
      .set(as(user))
      .send({ data: { amount: 10, currency: "USD", receptionMode: "in_person" } })
      .expect(200);
    expect(back.body.status).toBe("ANNOUNCED");
    await http().get(`/v1/experiences/${experienceId}/gifts/${giftId}/funding`).set(as(user)).expect(404);
  });
});

// ---------------------------------------------------------------------
// Parrainage, cartes cadeaux, administration des paiements (docs/13)
// ---------------------------------------------------------------------

/** Compte « nouveau » avec profil (le parrainage n'accepte que les comptes récents). */
async function profiledUser() {
  const id = await createUser();
  await pg.query("insert into app.profiles (id) values ($1) on conflict (id) do nothing", [id]);
  return id;
}

async function buy(user: string, planCode = "SOLO", useGiftCard = false) {
  const res = await http().post("/v1/orders").set(as(user)).send({ planCode, currency: "USD", payer, useGiftCard }).expect(201);
  if (res.body.status === "pending") await webhook(gateway.settle(res.body.id, "successful"));
  return res.body as { id: string; amount: string; discountAmount: string; creditAmount: string; status: string };
}

describe("Parrainage", () => {
  it("rattache un nouveau compte une seule fois, jamais à lui-même", async () => {
    const parrain = await profiledUser();
    const { body } = await http().get("/v1/referrals/me").set(as(parrain)).expect(200);
    expect(body.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await http().get("/v1/referrals/me").set(as(parrain)).expect(200)).body.code).toBe(body.code);

    await http().post("/v1/me/referral").set(as(parrain)).send({ code: body.code }).expect(409);
    const filleul = await profiledUser();
    await http().post("/v1/me/referral").set(as(filleul)).send({ code: "ZZZZZZZZ" }).expect(404);
    await http().post("/v1/me/referral").set(as(filleul)).send({ code: body.code.toLowerCase() }).expect(204);
    await http().post("/v1/me/referral").set(as(filleul)).send({ code: body.code }).expect(409);

    // Un compte ancien ne peut plus se déclarer filleul.
    const ancien = await profiledUser();
    await pg.query("update app.profiles set created_at = now() - interval '30 days' where id = $1", [ancien]);
    await http().post("/v1/me/referral").set(as(ancien)).send({ code: body.code }).expect(409);

    const summary = await http().get("/v1/referrals/me").set(as(parrain)).expect(200);
    expect(summary.body).toMatchObject({ qualified: 0, pending: 1 });
  });

  it("réduit le premier achat du filleul, le qualifie, puis récompense le parrain au palier", async () => {
    await pg.query(`update app.app_settings set value = '"0.20"' where key = 'referrals.referee_discount_rate'`);
    await pg.query(
      `update app.app_settings set value = '[{"threshold": 2, "amount": "5.00", "currency": "USD"}, {"threshold": 3, "amount": "10.00", "currency": "USD"}]' where key = 'referrals.reward_tiers'`,
    );
    const parrain = await profiledUser();
    const { code } = (await http().get("/v1/referrals/me").set(as(parrain)).expect(200)).body as { code: string };

    const filleuls = [await profiledUser(), await profiledUser()];
    for (const f of filleuls) await http().post("/v1/me/referral").set(as(f)).send({ code }).expect(204);

    const quote = await http().get("/v1/orders/quote?planCode=SOLO&currency=USD").set(as(filleuls[0]!)).expect(200);
    expect(quote.body).toMatchObject({ listAmount: "5.00", discountAmount: "1.00", discountRate: "0.20", totalWithoutCredit: "4.00", giftCardBalance: "0.00" });

    const first = await buy(filleuls[0]!);
    expect(first).toMatchObject({ amount: "4.00", discountAmount: "1.00" });
    expect(gateway.calls.at(-1)!.request.amount).toBe(4);
    expect((await http().get("/v1/referrals/me").set(as(parrain)).expect(200)).body).toMatchObject({ qualified: 1, pending: 1, giftCards: [] });

    // La réduction ne vaut que pour le premier achat.
    const again = await buy(filleuls[0]!);
    expect(again.discountAmount).toBe("0.00");

    // Un paiement échoué ne qualifie pas.
    const failing = await http().post("/v1/orders").set(as(filleuls[1]!)).send({ planCode: "SOLO", currency: "USD", payer }).expect(201);
    await webhook(gateway.settle(failing.body.id, "failed"));
    expect((await http().get("/v1/referrals/me").set(as(parrain)).expect(200)).body.qualified).toBe(1);

    await buy(filleuls[1]!);
    const summary = await http().get("/v1/referrals/me").set(as(parrain)).expect(200);
    expect(summary.body).toMatchObject({ qualified: 2, pending: 0 });
    expect(summary.body.tiers).toEqual([
      { threshold: 2, amount: "5.00", currency: "USD", reached: true },
      { threshold: 3, amount: "10.00", currency: "USD", reached: false },
    ]);
    expect(summary.body.giftCards).toEqual([expect.objectContaining({ amount: "5.00", balance: "5.00", currency: "USD", source: "referral" })]);

    // La carte paie une formule entière, sans passer par MbiyoPay.
    const calls = gateway.calls.length;
    const paidByCard = await http().post("/v1/orders").set(as(parrain)).send({ planCode: "SOLO", currency: "USD", useGiftCard: true }).expect(201);
    expect(paidByCard.body).toMatchObject({ status: "paid", amount: "0.00", creditAmount: "5.00", listAmount: "5.00" });
    expect(paidByCard.body.licenseId).toEqual(expect.any(String));
    expect(gateway.calls.length).toBe(calls);
    expect((await http().get("/v1/referrals/me").set(as(parrain)).expect(200)).body.giftCards[0].balance).toBe("0.00");
  });

  it("rend la carte cadeau si le reste à payer échoue", async () => {
    const owner = await profiledUser();
    await pg.query("insert into app.gift_cards (owner_id, amount, balance, currency, source, source_ref) values ($1, 5, 5, 'USD', 'admin', 'test:refund')", [owner]);
    const refused = await http().post("/v1/orders").set(as(owner)).send({ planCode: "MULTI_USE", currency: "USD", useGiftCard: true }).expect(422);
    expect(refused.body.error.code).toBe("PAYER_REQUIRED");

    const order = await http().post("/v1/orders").set(as(owner)).send({ planCode: "MULTI_USE", currency: "USD", payer, useGiftCard: true }).expect(201);
    expect(order.body).toMatchObject({ amount: "7.00", creditAmount: "5.00" });
    expect(gateway.calls.at(-1)!.request.amount).toBe(7);
    const held = await pg.query<{ balance: string }>("select balance::text as balance from app.gift_cards where owner_id = $1", [owner]);
    expect(held.rows[0]!.balance).toBe("0.00");

    await webhook(gateway.settle(order.body.id, "failed"));
    await http().get(`/v1/orders/${order.body.id}`).set(as(owner)).expect(200);
    const back = await pg.query<{ balance: string }>("select balance::text as balance from app.gift_cards where owner_id = $1", [owner]);
    expect(back.rows[0]!.balance).toBe("5.00");
    const moves = await pg.query<{ kind: string; amount: string }>("select kind, amount::text as amount from app.gift_card_movements where order_id = $1 order by id", [order.body.id]);
    expect(moves.rows).toEqual([
      { kind: "spend", amount: "-5.00" },
      { kind: "release", amount: "5.00" },
    ]);
  });
});

describe("Administration des paiements", () => {
  it("règle les frais, les transferts, la réduction et les paliers, en journalisant", async () => {
    const admin = await profiledUser();
    await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    const user = await profiledUser();
    await http().get("/v1/admin/payments/settings").set(as(user)).expect(403);

    const updated = await http()
      .put("/v1/admin/payments/settings")
      .set(as(admin))
      .send({
        moneyFeeRate: "0.035",
        moneyTransfersEnabled: true,
        refereeDiscountRate: "0.15",
        rewardTiers: [
          { threshold: 50, amount: "10.00", currency: "USD" },
          { threshold: 25, amount: "5.00", currency: "USD" },
        ],
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      mode: "sandbox",
      webhookUrl: "https://api.zaweli.test/v1/webhooks/mbiyopay",
      moneyFeeRate: "0.035",
      moneyTransfersEnabled: true,
      refereeDiscountRate: "0.15",
      rewardTiers: [
        { threshold: 25, amount: "5.00", currency: "USD" },
        { threshold: 50, amount: "10.00", currency: "USD" },
      ],
    });
    await http().put("/v1/admin/payments/settings").set(as(admin)).send({ moneyFeeRate: "4" }).expect(400);
    const audit = await pg.query<{ n: number }>("select count(*)::int as n from app.audit_log where action = 'setting.updated' and actor_id = $1", [admin]);
    expect(audit.rows[0]!.n).toBe(4);
  });

  it("liste commandes et transferts, et revérifie les paiements en attente", async () => {
    const admin = await profiledUser();
    await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    const buyer = await profiledUser();
    const order = await http().post("/v1/orders").set(as(buyer)).send({ planCode: "SOLO", currency: "USD", payer }).expect(201);
    // Le prestataire confirme, mais aucun webhook n'arrive et personne ne rouvre la page.
    gateway.settle(order.body.id, "successful");
    await pg.query("update app.payments set checked_at = now() - interval '5 minutes' where order_id = $1", [order.body.id]);

    const result = await http().post("/v1/admin/payments/reconcile").set(as(admin)).expect(200);
    expect(result.body.settled).toBeGreaterThanOrEqual(1);
    const orders = await http().get("/v1/admin/payments/orders").set(as(admin)).expect(200);
    expect(orders.body.find((o: { id: string }) => o.id === order.body.id)).toMatchObject({ status: "paid", plan: "Solo", providerRef: expect.any(String) });
    const transfers = await http().get("/v1/admin/payments/transfers").set(as(admin)).expect(200);
    expect(Array.isArray(transfers.body)).toBe(true);
    const referrers = await http().get("/v1/admin/payments/referrers").set(as(admin)).expect(200);
    expect(referrers.body[0]).toMatchObject({ qualified: expect.any(Number), cardsGranted: expect.any(Number) });
  });
});

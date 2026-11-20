/**
 * Finitions de l'expérience client (docs/15) : code d'accès et date
 * d'ouverture, musique, duplication, export et suppression du compte,
 * rappel d'expiration. API réelle sur les migrations réelles (PGlite).
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import { coffretV1 } from "@zaweli/template-coffret";
import { manifestHash } from "@zaweli/template-engine/schema";
import { ThrottlerStorage } from "@nestjs/throttler";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JwtVerifierService } from "../src/auth/jwt-verifier.service.js";
import { DB } from "../src/database/database.module.js";
import { AuthAdmin } from "../src/me/account.service.js";
import { MailService } from "../src/notifications/mail.service.js";
import { createTestDatabase } from "./support/pglite.js";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.PUBLIC_WEB_URL = "https://zaweli.test";

/** Supabase Auth simulé : on garde la trace des suppressions et anonymisations. */
class FakeAuthAdmin extends AuthAdmin {
  readonly available = true;
  readonly deleted: string[] = [];
  readonly anonymized: string[] = [];
  async deleteUser(id: string) {
    this.deleted.push(id);
  }
  async anonymizeUser(id: string) {
    this.anonymized.push(id);
  }
  readonly banned = new Map<string, boolean>();
  async setBanned(id: string, banned: boolean) {
    this.banned.set(id, banned);
  }
}

let app: INestApplication;
let pg: PGlite;
const authAdmin = new FakeAuthAdmin();
const http = () => request(app.getHttpServer());
const as = (userId: string) => ({ authorization: `Bearer test:${userId}` });
const music = {
  source: "audius",
  trackId: "OPgMl",
  title: "Birthday",
  artist: "Benny Clavis",
  permalink: "/bennyclavis/happy-birthday",
  durationSeconds: 154,
  artworkUrl: "https://cn.example/480x480.jpg",
};

async function newUser() {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, `${id}@zaweli.test`]);
  await pg.query("insert into app.profiles (id) values ($1) on conflict (id) do nothing", [id]);
  return id;
}

async function publishedFor(userId: string) {
  const photos: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = randomUUID();
    await pg.query(
      `insert into app.media_assets (id, owner_id, status, upload_path, declared_mime, declared_size_bytes, detected_mime, width, height, published_variants)
       values ($1, $2, 'ready', $3, 'image/webp', 1000, 'image/webp', 900, 1200, $4)`,
      [id, userId, `${userId}/${id}`, JSON.stringify({ lg: `https://cdn.test/storage/v1/object/public/published/${id}/lg.webp` })],
    );
    photos.push(id);
  }
  const photo = (mediaId: string) => ({ mediaId, alt: "Une photo" });
  const recipient = await http().post("/v1/recipients").set(as(userId)).send({ displayName: "Pauline", contactEmail: "pauline@exemple.cd" }).expect(201);
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
  await http()
    .post(`/v1/experiences/${id}/gifts`)
    .set(as(userId))
    .send({ type: "VOUCHER", data: { title: "Un massage", issuer: "Spa du fleuve" }, protectedData: { code: "SPA-2026" } })
    .expect(201);
  const published = await http().post(`/v1/experiences/${id}/publish`).set(as(userId)).send({ useFree: true });
  expect(published.status, JSON.stringify(published.body)).toBe(200);
  return { id, slug: published.body.slug as string, recipientId: recipient.body.id as string };
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
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, template_access_mode) values ('SOLO', 'Solo', true, true, 7, 'all')`);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(database.db)
    .overrideProvider(AuthAdmin)
    .useValue(authAdmin)
    // Plusieurs suppressions de compte d'affilée depuis la même adresse : la limite de débit est testée ailleurs.
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
  app = configureApp(moduleRef.createNestApplication());
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pg?.close();
});

describe("Ouverture de l'expérience", () => {
  it("demande le code choisi par l'expéditeur, sans jamais le stocker en clair", async () => {
    const user = await newUser();
    const { id, slug } = await publishedFor(user);
    const set = await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ accessCode: "Pauline2026" }).expect(200);
    expect(set.body.hasAccessCode).toBe(true);
    const stored = await pg.query<{ access_code_hash: string }>("select access_code_hash from app.experiences where id = $1", [id]);
    expect(stored.rows[0]!.access_code_hash).toMatch(/^scrypt\$/);
    expect(stored.rows[0]!.access_code_hash).not.toContain("Pauline2026");

    expect((await http().get(`/v1/public/experiences/${slug}`).expect(401)).body.error.code).toBe("ACCESS_CODE_REQUIRED");
    expect((await http().post(`/v1/public/experiences/${slug}/unlock`).send({ code: "mauvais" }).expect(403)).body.error.code).toBe("ACCESS_CODE_INVALID");
    // Insensible à la casse et aux espaces autour.
    const unlocked = await http().post(`/v1/public/experiences/${slug}/unlock`).send({ code: "  pauline2026 " }).expect(200);
    expect(unlocked.body.rendererKey).toBe("coffret@1.0.0");
    await http().get(`/v1/public/experiences/${slug}`).set("x-access-code", "PAULINE2026").expect(200);

    // Le code d'un bon cadeau ne sort qu'avec le bon code d'accès.
    const voucher = (Object.values(unlocked.body.payload.fields).flat() as Array<{ type?: string; id: string }>).find((g) => g?.type === "VOUCHER")!;
    await http().post(`/v1/public/experiences/${slug}/gifts/${voucher.id}/reveal`).expect(401);
    const revealed = await http().post(`/v1/public/experiences/${slug}/gifts/${voucher.id}/reveal`).set("x-access-code", "pauline2026").expect(200);
    expect(revealed.body.data).toEqual({ code: "SPA-2026" });

    await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ accessCode: null }).expect(200);
    await http().get(`/v1/public/experiences/${slug}`).expect(200);
    const audit = await pg.query<{ data: Record<string, unknown> }>("select data from app.audit_log where entity_id = $1 and action = 'experience.settings_updated' order by id", [id]);
    expect(JSON.stringify(audit.rows)).not.toContain("Pauline2026");
  });

  it("annonce la date d'ouverture avant l'heure, puis ouvre", async () => {
    const user = await newUser();
    const { id, slug } = await publishedFor(user);
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ availableFrom: later }).expect(200);
    const locked = await http().get(`/v1/public/experiences/${slug}`).expect(423);
    expect(locked.body.error).toMatchObject({ code: "NOT_YET_AVAILABLE", details: { availableFrom: later } });
    await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ availableFrom: null }).expect(200);
    await http().get(`/v1/public/experiences/${slug}`).expect(200);
  });

  it("joue la musique choisie, réglée sans republier", async () => {
    const user = await newUser();
    const { id, slug } = await publishedFor(user);
    await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ music: { ...music, source: "spotify" } }).expect(400);
    const set = await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ music }).expect(200);
    expect(set.body.music).toEqual(music);
    expect((await http().get(`/v1/public/experiences/${slug}`).expect(200)).body.payload.music).toEqual(music);
    expect((await http().get(`/v1/experiences/${id}/preview`).set(as(user)).expect(200)).body.payload.music).toEqual(music);
    await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ music: null }).expect(200);
    expect((await http().get(`/v1/public/experiences/${slug}`).expect(200)).body.payload.music).toBeUndefined();
  });

  it("réserve les réglages à l'auteur", async () => {
    const user = await newUser();
    const other = await newUser();
    const { id } = await publishedFor(user);
    await http().put(`/v1/experiences/${id}/settings`).set(as(other)).send({ accessCode: "abcd" }).expect(404);
  });
});

describe("Dupliquer pour une autre personne", () => {
  it("crée un brouillon avec le même contenu, les mêmes photos et les cadeaux recopiés", async () => {
    const user = await newUser();
    const { id } = await publishedFor(user);
    await http().put(`/v1/experiences/${id}/settings`).set(as(user)).send({ music }).expect(200);
    const other = await http().post("/v1/recipients").set(as(user)).send({ displayName: "Grâce" }).expect(201);
    const copy = await http().post(`/v1/experiences/${id}/duplicate`).set(as(user)).send({ recipientId: other.body.id }).expect(201);
    expect(copy.body).toMatchObject({ status: "draft", recipient: { displayName: "Grâce" }, music, publishIssues: [] });
    expect(copy.body.id).not.toBe(id);
    expect(copy.body.gifts).toHaveLength(1);
    const source = await http().get(`/v1/experiences/${id}`).set(as(user)).expect(200);
    expect(copy.body.gifts[0].id).not.toBe(source.body.gifts[0].id);
    expect(copy.body.content.fields.gifts).toEqual([copy.body.gifts[0].id]);
    expect(copy.body.content.fields.jewelPhoto).toEqual(source.body.content.fields.jewelPhoto);
    // Pas de duplication vers le destinataire d'un autre compte.
    const stranger = await newUser();
    const theirs = await http().post("/v1/recipients").set(as(stranger)).send({ displayName: "X" }).expect(201);
    await http().post(`/v1/experiences/${id}/duplicate`).set(as(user)).send({ recipientId: theirs.body.id }).expect(404);
  });
});

describe("Mon compte", () => {
  it("enregistre les préférences d'e-mail", async () => {
    const user = await newUser();
    const res = await http().patch("/v1/me/profile").set(as(user)).send({ notifyLicenseExpiry: false, marketingOptIn: true }).expect(200);
    expect(res.body).toMatchObject({ notifyLicenseExpiry: false, marketingOptIn: true });
  });

  it("exporte toutes les données du compte", async () => {
    const user = await newUser();
    await publishedFor(user);
    const res = await http().get("/v1/me/export").set(as(user)).expect(200);
    expect(res.headers["content-disposition"]).toContain("zaweli-mes-donnees.json");
    expect(res.body.account).toMatchObject({ id: user, email: `${user}@zaweli.test` });
    expect(res.body.recipients[0]).toMatchObject({ display_name: "Pauline", contact_email: "pauline@exemple.cd" });
    expect(res.body.experiences).toHaveLength(1);
    expect(res.body.gifts).toHaveLength(1);
  });

  it("supprime le compte sans achat ; anonymise celui qui a des pièces comptables", async () => {
    const user = await newUser();
    const { slug } = await publishedFor(user);
    await http().delete("/v1/me").set(as(user)).send({ confirmEmail: "autre@exemple.com" }).expect(400);
    await http().delete("/v1/me").set(as(user)).send({ confirmEmail: `${user}@ZAWELI.test` }).expect(204);
    expect(authAdmin.deleted).toContain(user);
    // Le lien public ne s'ouvre plus, les destinataires sont effacés.
    await http().get(`/v1/public/experiences/${slug}`).expect(404);
    // Purge : plus d'instantané publié ni de cadeau en base.
    const left = await pg.query<{ snapshots: number; gifts: number; purged: boolean }>(
      `select (select count(*)::int from app.experience_snapshots s join app.experiences e on e.id = s.experience_id where e.owner_id = $1) as snapshots,
              (select count(*)::int from app.gifts where owner_id = $1) as gifts,
              (select purged_at is not null from app.profiles where id = $1) as purged`,
      [user],
    );
    expect(left.rows[0]).toEqual({ snapshots: 0, gifts: 0, purged: true });
    const recipient = await pg.query<{ display_name: string; contact_email: string | null }>("select display_name, contact_email from app.recipients where owner_id = $1", [user]);
    expect(recipient.rows[0]).toEqual({ display_name: "—", contact_email: null });

    const buyer = await newUser();
    await pg.query("insert into app.plan_prices (plan_id, currency, amount) select id, 'XAF', 3000 from app.plans where code = 'SOLO' on conflict do nothing");
    await pg.exec("begin");
    await pg.query("select set_config('app.actor', 'provider', true)");
    await pg.query(
      `insert into app.orders (user_id, plan_id, plan_price_id, amount, currency, status, idempotency_key, provider, paid_at)
       select $1, p.id, pp.id, 3000, 'XAF', 'paid', 'key-delete-1', 'mbiyopay', now()
         from app.plans p join app.plan_prices pp on pp.plan_id = p.id and pp.currency = 'XAF' where p.code = 'SOLO' limit 1`,
      [buyer],
    );
    await pg.exec("commit");
    await http().delete("/v1/me").set(as(buyer)).send({ confirmEmail: `${buyer}@zaweli.test` }).expect(204);
    expect(authAdmin.anonymized).toContain(buyer);
    expect(authAdmin.deleted).not.toContain(buyer);
    const kept = await pg.query<{ n: number }>("select count(*)::int as n from app.orders where user_id = $1", [buyer]);
    expect(kept.rows[0]!.n).toBe(1);
  });

  it("refuse la suppression tant qu'un cadeau d'argent payé attend son destinataire", async () => {
    const user = await newUser();
    const { id } = await publishedFor(user);
    await pg.query("update app.app_settings set value = 'true' where key = 'gifts.money_transfers_enabled'");
    await pg.exec("begin");
    await pg.query("select set_config('app.actor', 'system', true)");
    await pg.query(
      `insert into app.gifts (owner_id, experience_id, position, gift_type, status, data, amount, currency)
       values ($1, $2, 9, 'MONEY', 'AWAITING_FUNDING', '{"amount": 10, "currency": "USD", "receptionMode": "zaweli_transfer"}', 10, 'USD')`,
      [user, id],
    );
    await pg.query("select set_config('app.actor', 'provider', true)");
    await pg.query("update app.gifts set status = 'FUNDED' where experience_id = $1 and gift_type = 'MONEY'", [id]);
    await pg.exec("commit");
    const refused = await http().delete("/v1/me").set(as(user)).send({ confirmEmail: `${user}@zaweli.test` }).expect(409);
    expect(refused.body.error.code).toBe("ACCOUNT_HAS_PENDING_MONEY");
  });
});

describe("Pays à l'inscription", () => {
  it("reprend le pays choisi dans le formulaire comme pays déclaré, et ignore un code invalide", async () => {
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    await pg.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'a@zaweli.test', $2)", [a, JSON.stringify({ locale: "fr", country: "cd" })]);
    await pg.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'b@zaweli.test', $2)", [b, JSON.stringify({ country: "Congo" })]);
    await pg.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'c@zaweli.test', '{}')", [c]);
    const rows = await pg.query<{ id: string; country_code: string | null; country_source: string | null }>(
      "select id, country_code, country_source from app.profiles where id = any($1::uuid[])",
      [[a, b, c]],
    );
    const by = Object.fromEntries(rows.rows.map((r) => [r.id, [r.country_code, r.country_source]]));
    expect(by[a]).toEqual(["CD", "declared"]);
    expect(by[b]).toEqual([null, null]);
    expect(by[c]).toEqual([null, null]);
  });
});

describe("Rappel d'expiration", () => {
  it("prévient une seule fois, sauf si la personne l'a désactivé", async () => {
    const mail = app.get(MailService);
    const sent: string[] = [];
    (mail as unknown as { transport: unknown }).transport = { sendMail: async (m: { to: string }) => void sent.push(m.to) };
    const [yes, no] = [await newUser(), await newUser()];
    await pg.query("update app.profiles set notify_license_expiry = false where id = $1", [no]);
    for (const u of [yes, no]) {
      await pg.query(
        `insert into app.licenses (user_id, plan_id, source, status, starts_at, ends_at, start_policy, template_access_mode, edit_policy, max_publications_per_day, ai_generations_max)
         select $1, id, 'admin_grant', 'active', now(), now() + interval '2 days', 'immediate', 'all', 'while_valid', 20, 0 from app.plans where code = 'SOLO'`,
        [u],
      );
    }
    await mail.sendExpiryReminders();
    await mail.sendExpiryReminders();
    expect(sent.filter((to) => to === `${yes}@zaweli.test`)).toHaveLength(1);
    expect(sent).not.toContain(`${no}@zaweli.test`);
  });
});

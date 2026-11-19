/**
 * Tests d'intégration de l'API métier : l'application NestJS réelle
 * (gardes, validation, filtre d'erreurs, contrôleurs, services) contre les
 * migrations réelles, sur PostgreSQL embarqué (PGlite). Sans Docker.
 *
 * Seule la vérification des jetons Supabase est remplacée : un jeton de test
 * « test:<uuid> » désigne directement l'utilisateur.
 *
 * Les numéros S1… renvoient aux scénarios du cahier des charges (§13).
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { coffretV1 } from "@zaweli/template-coffret";
import { manifestHash } from "@zaweli/template-engine/schema";
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
const http = () => request(app.getHttpServer());
const as = (userId: string) => ({ authorization: `Bearer test:${userId}` });

async function createUser(verified = true) {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [
    id,
    `${id}@zaweli.test`,
    verified ? new Date() : null,
  ]);
  return id;
}

/** Photos « prêtes et publiées » (la chaîne de traitement des médias est simulée). */
async function readyPhotos(ownerId: string, count = 5) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
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

const photo = (mediaId: string) => ({ mediaId, alt: "Une photo de nous" });

function coffretContent(photos: string[]) {
  return {
    fields: {
      name: "Pauline",
      sealCard: "Aujourd'hui, tout ce qui se trouve ici t'appartient.",
      sealCta: "Je suis prête",
      jewelTitle: "Un écrin pour toi",
      jewelPhoto: photo(photos[0]!),
      jewelReveal: "La plus belle, c'est toi.",
      riddles: [
        { question: "Où nous sommes-nous rencontrés ?", choices: ["Kinshasa", "Paris", "Lubumbashi"], answer: 0, photo: photo(photos[1]!), reveal: "À Kinshasa, bien sûr." },
      ],
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
  };
}

async function newRecipient(userId: string, displayName: string) {
  const res = await http().post("/v1/recipients").set(as(userId)).send({ displayName }).expect(201);
  return res.body.id as string;
}

/** Brouillon Coffret complet, avec un cadeau, prêt à publier. */
async function readyDraft(userId: string, recipientId: string) {
  const photos = await readyPhotos(userId);
  const created = await http().post("/v1/experiences").set(as(userId)).send({ templateSlug: "coffret", recipientId }).expect(201);
  const id = created.body.id as string;
  await http().patch(`/v1/experiences/${id}`).set(as(userId)).send({ content: coffretContent(photos) }).expect(200);
  await http()
    .post(`/v1/experiences/${id}/gifts`)
    .set(as(userId))
    .send({ type: "PHYSICAL", data: { name: "Un carnet de voyage" } })
    .expect(201);
  return id;
}

beforeAll(async () => {
  const database = await createTestDatabase();
  pg = database.pg;

  // Catalogue : Coffret 1.0.0 publié (comme `pnpm templates:sync` + administration).
  const category = await pg.query<{ id: string }>("select id from app.template_categories where slug = 'anniversaire'");
  const template = await pg.query<{ id: string }>(
    `insert into app.templates (slug, name, description, category_id, status, translations)
     values ('coffret', 'Coffret', $1, $2, 'published', $3) returning id`,
    [coffretV1.description, category.rows[0]!.id, JSON.stringify({ en: { name: "Jewel box", description: "A jewel box to open step by step." } })],
  );
  const templateId = template.rows[0]!.id;
  const version = await pg.query<{ id: string }>(
    `insert into app.template_versions (template_id, version, renderer_key, manifest, manifest_hash, status, published_at)
     values ($1, '1.0.0', 'coffret@1.0.0', $2, $3, 'published', now()) returning id`,
    [templateId, JSON.stringify(coffretV1), await manifestHash(coffretV1)],
  );
  await pg.query("update app.templates set current_version_id = $1 where id = $2", [version.rows[0]!.id, templateId]);
  await pg.query("insert into app.template_access_tags (template_id, tag) values ($1, 'free-eligible')", [templateId]);
  await pg.query("update app.app_settings set value = '50' where key = 'drafts.max_active'");

  // Formules de test (aucune valeur commerciale réelle).
  await pg.query(`insert into app.plans (code, name, is_free, is_active, is_public, publications_max, template_access_mode, template_access_tag, edit_policy, edit_days, translations)
                  values ('FREE', 'Gratuit', true, true, true, 1, 'tagged', 'free-eligible', 'days', 7, '{"en":{"name":"Free"}}')`);
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, recipients_max, template_access_mode, max_publications_per_day)
                  values ('MULTI_USE', 'Multi-usage', true, true, 30, 3, 'all', 50)`);

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
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pg?.close();
});

describe("Deux langues", () => {
  it("renvoie les erreurs dans la langue demandée, avec le même code", async () => {
    const fr = await http().get("/v1/experiences").expect(401);
    expect(fr.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "Authentification requise." });
    expect(fr.headers["content-language"]).toBe("fr");

    const en = await http().get("/v1/experiences").set("accept-language", "en-US,en;q=0.9,fr;q=0.5").expect(401);
    expect(en.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "Sign-in required." });
    expect(en.headers["content-language"]).toBe("en");

    const query = await http().get("/v1/experiences?lang=en").expect(401);
    expect(query.body.error.message).toBe("Sign-in required.");
  });

  it("traduit le catalogue et les formules, en repliant sur le français", async () => {
    const fr = await http().get("/v1/catalog/templates").expect(200);
    expect(fr.body[0]).toMatchObject({ slug: "coffret", name: "Coffret", category: { slug: "anniversaire", name: "Anniversaire" } });
    const en = await http().get("/v1/catalog/templates?lang=en").expect(200);
    expect(en.body[0]).toMatchObject({ name: "Jewel box", category: { name: "Birthday" }, accessTags: ["free-eligible"] });

    const plans = await http().get("/v1/plans").set("accept-language", "en").expect(200);
    expect(plans.body.map((p: { name: string }) => p.name)).toEqual(["Free", "Multi-usage"]);
  });

  it("garde la langue choisie dans le profil", async () => {
    const user = await createUser();
    const res = await http().patch("/v1/me/profile").set(as(user)).send({ locale: "en", displayName: "Carlo" }).expect(200);
    expect(res.body).toMatchObject({ locale: "en", displayName: "Carlo", emailVerified: true });
    await http().patch("/v1/me/profile").set(as(user)).send({ locale: "de" }).expect(400);
  });

  it("reprend la langue et le nom transmis à l'inscription (e-mail ou Google)", async () => {
    const id = randomUUID();
    await pg.query("insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), $3)", [
      id,
      `${id}@zaweli.test`,
      JSON.stringify({ locale: "en", full_name: "Ada Lovelace" }),
    ]);
    const res = await http().get("/v1/me/profile").set(as(id)).expect(200);
    expect(res.body).toMatchObject({ locale: "en", displayName: "Ada Lovelace" });

    const odd = randomUUID();
    await pg.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [odd, `${odd}@zaweli.test`, JSON.stringify({ locale: "xx" })]);
    expect((await http().get("/v1/me/profile").set(as(odd))).body).toMatchObject({ locale: "fr", displayName: null, emailVerified: false });
  });

  it("détaille un modèle : étapes, sections facultatives, types de cadeaux", async () => {
    const res = await http().get("/v1/catalog/templates/coffret").expect(200);
    expect(res.body.steps[0]).toMatchObject({ id: "recipient" });
    expect(res.body.giftTypes).toContain("VOUCHER");
    expect(res.body.fields.name).toMatchObject({ kind: "shortText", required: true, max: 24 });
    await http().get("/v1/catalog/templates/inconnu").expect(404);
  });
});

describe("Formule gratuite (S1, S2)", () => {
  it("S1 : un compte vérifié publie avec le droit FREE choisi explicitement", async () => {
    const user = await createUser();
    const recipient = await newRecipient(user, "Pauline");
    const id = await readyDraft(user, recipient);

    const detail = await http().get(`/v1/experiences/${id}`).set(as(user)).expect(200);
    expect(detail.body.publishIssues).toEqual([]);

    const eligibility = await http().get(`/v1/experiences/${id}/eligibility`).set(as(user)).expect(200);
    expect(eligibility.body.candidates).toHaveLength(1);
    expect(eligibility.body.candidates[0]).toMatchObject({ planCode: "FREE", requiresExplicitChoice: true });
    expect(eligibility.body.defaultLicenseId).toBeNull();

    // Sans choix explicite, le droit FREE n'est pas « brûlé » par erreur.
    const refused = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({}).expect(409);
    expect(refused.body.error.code).toBe("NO_ELIGIBLE_LICENSE");

    const published = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(200);
    expect(published.body.slug).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(published.body.url).toBe(`https://zaweli.test/g/${published.body.slug}`);

    // Double clic : même réponse, rien n'est consommé deux fois.
    const again = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(200);
    expect(again.body.slug).toBe(published.body.slug);

    const pub = await http().get(`/v1/public/experiences/${published.body.slug}`).expect(200);
    expect(pub.body.rendererKey).toBe("coffret@1.0.0");
    expect(pub.body.payload.locale).toBe("fr");
    expect(pub.body.payload.fields.name).toBe("Pauline");
    expect(JSON.stringify(pub.body)).not.toContain('"answer"');

    const licenses = await http().get("/v1/licenses").set(as(user)).expect(200);
    expect(licenses.body[0]).toMatchObject({ source: "free", publications: { used: 1, max: 1 } });
    const english = await http().get("/v1/licenses").set(as(user)).set("accept-language", "en").expect(200);
    expect(english.body[0].plan).toEqual({ code: "FREE", name: "Free" });
  });

  it("S2 : la seconde publication sans licence est refusée, le brouillon est conservé", async () => {
    const user = await createUser();
    const recipient = await newRecipient(user, "Amani");
    const first = await readyDraft(user, recipient);
    await http().post(`/v1/experiences/${first}/publish`).set(as(user)).send({ useFree: true }).expect(200);

    const second = await readyDraft(user, recipient);
    const res = await http().post(`/v1/experiences/${second}/publish`).set(as(user)).send({ useFree: true }).expect(409);
    expect(res.body.error.code).toBe("NO_ELIGIBLE_LICENSE");
    const draft = await http().get(`/v1/experiences/${second}`).set(as(user)).expect(200);
    expect(draft.body.status).toBe("draft");
  });

  it("le droit FREE exige un e-mail vérifié", async () => {
    const user = await createUser(false);
    const recipient = await newRecipient(user, "Grace");
    const id = await readyDraft(user, recipient);
    const res = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).set("accept-language", "en").send({ useFree: true }).expect(409);
    expect(res.body.error).toMatchObject({ code: "FREE_LICENSE_REQUIRES_VERIFIED_EMAIL", message: "Confirm your email address to use the free creation." });
  });
});

describe("MULTI-USE (S7, S8)", () => {
  it("3 destinataires liés, le 4e est refusé, un destinataire déjà lié reste couvert", async () => {
    const user = await createUser();
    const admin = await createUser();
    await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    await http().post("/v1/admin/licenses").set(as(admin)).send({ userId: user, planCode: "MULTI_USE", reason: "test" }).expect(201);

    const recipients = [];
    for (const name of ["Ada", "Bea", "Cleo", "Dina"]) recipients.push(await newRecipient(user, name));
    for (const r of recipients.slice(0, 3)) {
      const id = await readyDraft(user, r);
      await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({}).expect(200);
    }

    const fourth = await readyDraft(user, recipients[3]!);
    const eligibility = await http().get(`/v1/experiences/${fourth}/eligibility`).set(as(user)).expect(200);
    expect(eligibility.body.candidates.filter((c: { planCode: string }) => c.planCode === "MULTI_USE")).toHaveLength(0);
    const refused = await http().post(`/v1/experiences/${fourth}/publish`).set(as(user)).send({}).expect(409);
    expect(refused.body.error.code).toBe("NO_ELIGIBLE_LICENSE");

    // Licence imposée : la base elle-même refuse le 4e destinataire.
    const license = (await http().get("/v1/licenses").set(as(user))).body.find((l: { plan: { code: string } }) => l.plan.code === "MULTI_USE");
    const forced = await http().post(`/v1/experiences/${fourth}/publish`).set(as(user)).send({ licenseId: license.id }).expect(409);
    expect(forced.body.error.code).toBe("LICENSE_RECIPIENT_LIMIT_REACHED");

    const again = await readyDraft(user, recipients[0]!);
    await http().post(`/v1/experiences/${again}/publish`).set(as(user)).send({}).expect(200);

    // Une fiche liée ne peut pas être supprimée.
    const del = await http().delete(`/v1/recipients/${recipients[0]}`).set(as(user)).expect(409);
    expect(del.body.error.code).toBe("RECIPIENT_IN_USE");
  });
});

describe("Cadeaux (S11, S13, S14)", () => {
  let user: string;
  let id: string;

  beforeAll(async () => {
    user = await createUser();
    id = await readyDraft(user, await newRecipient(user, "Esther"));
  });

  it("S11 : un cadeau d'argent reste une promesse, jamais « transféré »", async () => {
    const gift = await http()
      .post(`/v1/experiences/${id}/gifts`)
      .set(as(user))
      .send({ type: "MONEY", data: { amount: 50, currency: "USD", receptionMode: "in_person" } })
      .expect(201);
    expect(gift.body.status).toBe("ANNOUNCED");
    const transfer = await http().post(`/v1/experiences/${id}/gifts/${gift.body.id}/status`).set(as(user)).send({ status: "TRANSFERRED" }).expect(409);
    expect(transfer.body.error.code).toBe("GIFT_TRANSITION_NOT_ALLOWED");
  });

  it("S14 : le modèle n'accepte pas plus de 3 cadeaux", async () => {
    await http()
      .post(`/v1/experiences/${id}/gifts`)
      .set(as(user))
      .send({ type: "VOUCHER", data: { title: "Un massage" }, protectedData: { code: "SPA-2026" } })
      .expect(201);
    const res = await http().post(`/v1/experiences/${id}/gifts`).set(as(user)).send({ type: "PHYSICAL", data: { name: "Un livre" } }).expect(409);
    expect(res.body.error.code).toBe("GIFT_LIMIT_REACHED");
  });

  it("refuse des données de cadeau invalides", async () => {
    const res = await http().post(`/v1/experiences/${id}/gifts`).set(as(user)).send({ type: "INVITATION", data: { title: "Fête" } }).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("S13 : le code du bon est absent de la page, livré seulement au déballage", async () => {
    const admin = await createUser();
    await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    await http().post("/v1/admin/licenses").set(as(admin)).send({ userId: user, planCode: "MULTI_USE", reason: "test" }).expect(201);
    const { body } = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({}).expect(200);

    const pub = await http().get(`/v1/public/experiences/${body.slug}`).expect(200);
    expect(JSON.stringify(pub.body)).not.toContain("SPA-2026");
    const voucher = (pub.body.payload.fields.gifts as Array<{ id: string; type: string; status: string }>).find((g) => g.type === "VOUCHER")!;
    const money = (pub.body.payload.fields.gifts as Array<{ id: string; type: string; status: string }>).find((g) => g.type === "MONEY")!;
    expect(money.status).toBe("ANNOUNCED");

    const revealed = await http().post(`/v1/public/experiences/${body.slug}/gifts/${voucher.id}/reveal`).expect(200);
    expect(revealed.body.data).toEqual({ code: "SPA-2026" });
    await http().post(`/v1/public/experiences/${body.slug}/gifts/${money.id}/reveal`).expect(409);
  });
});

describe("Contenu, propriété et révisions", () => {
  it("valide le contenu contre le manifeste de la version figée", async () => {
    const user = await createUser();
    const recipient = await newRecipient(user, "Fifi");
    const created = await http().post("/v1/experiences").set(as(user)).send({ templateSlug: "coffret", recipientId: recipient, locale: "en" }).expect(201);
    expect(created.body).toMatchObject({ status: "draft", locale: "en", contentRevision: 1 });
    expect(created.body.publishIssues.length).toBeGreaterThan(0);

    const tooLong = await http()
      .patch(`/v1/experiences/${created.body.id}`)
      .set(as(user))
      .send({ content: { fields: { name: "x".repeat(25) } } })
      .expect(422);
    expect(tooLong.body.error.code).toBe("EXPERIENCE_CONTENT_INVALID");
    expect(tooLong.body.error.details[0].path).toBe("fields.name");

    const unknownField = await http().patch(`/v1/experiences/${created.body.id}`).set(as(user)).send({ content: { fields: { script: "<b>" } } }).expect(422);
    expect(unknownField.body.error.code).toBe("EXPERIENCE_CONTENT_INVALID");

    // Deux onglets : la révision lue protège contre l'écrasement.
    await http().patch(`/v1/experiences/${created.body.id}`).set(as(user)).send({ title: "Pour Fifi", expectedRevision: 1 }).expect(200);
    const stale = await http().patch(`/v1/experiences/${created.body.id}`).set(as(user)).send({ title: "Autre", expectedRevision: 1 }).expect(409);
    expect(stale.body.error.code).toBe("EXPERIENCE_REVISION_CONFLICT");
  });

  it("refuse une photo qui n'est pas prête", async () => {
    const user = await createUser();
    const recipient = await newRecipient(user, "Gloria");
    const id = await readyDraft(user, recipient);
    await pg.query("update app.media_assets set status = 'processing' where owner_id = $1", [user]);
    const res = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(409);
    expect(res.body.error.code).toBe("MEDIA_NOT_READY");
  });

  it("n'expose jamais l'expérience ou le destinataire d'un autre utilisateur", async () => {
    const owner = await createUser();
    const other = await createUser();
    const recipient = await newRecipient(owner, "Hawa");
    const id = await readyDraft(owner, recipient);
    await http().get(`/v1/experiences/${id}`).set(as(other)).expect(404);
    await http().patch(`/v1/recipients/${recipient}`).set(as(other)).send({ displayName: "X" }).expect(404);
    const res = await http().post("/v1/experiences").set(as(other)).send({ templateSlug: "coffret", recipientId: recipient }).expect(404);
    expect(res.body.error.code).toBe("RECIPIENT_NOT_FOUND");
    expect((await http().get("/v1/experiences").set(as(other))).body).toEqual([]);
  });

  it("limite le nombre de brouillons actifs (C18)", async () => {
    const user = await createUser();
    const recipient = await newRecipient(user, "Ines");
    await pg.query("update app.app_settings set value = '1' where key = 'drafts.max_active'");
    try {
      await http().post("/v1/experiences").set(as(user)).send({ templateSlug: "coffret", recipientId: recipient }).expect(201);
      const res = await http().post("/v1/experiences").set(as(user)).send({ templateSlug: "coffret", recipientId: recipient }).expect(409);
      expect(res.body.error).toMatchObject({ code: "DRAFT_LIMIT_REACHED", details: { max: 1 } });
    } finally {
      await pg.query("update app.app_settings set value = '50' where key = 'drafts.max_active'");
    }
  });
});

describe("Désactivation, expiration et modération (S9, S10, S19)", () => {
  it("désactiver puis réactiver un lien", async () => {
    const user = await createUser();
    const id = await readyDraft(user, await newRecipient(user, "Josée"));
    const { body } = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(200);
    await http().post(`/v1/experiences/${id}/disable`).set(as(user)).expect(200);
    await http().get(`/v1/public/experiences/${body.slug}`).expect(404);
    await http().post(`/v1/experiences/${id}/enable`).set(as(user)).expect(200);
    await http().get(`/v1/public/experiences/${body.slug}`).expect(200);
  });

  it("S9 et S10 : licence expirée, modification refusée, lien toujours ouvert", async () => {
    const user = await createUser();
    const id = await readyDraft(user, await newRecipient(user, "Kiki"));
    const { body } = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(200);
    // Fenêtre de modification de 7 jours (formule FREE de test) dépassée.
    await pg.query("update app.experiences set first_published_at = now() - interval '8 days' where id = $1", [id]);

    const res = await http().patch(`/v1/experiences/${id}`).set(as(user)).send({ title: "Trop tard" }).expect(409);
    expect(res.body.error.code).toBe("EXPERIENCE_NOT_EDITABLE");
    await http().get(`/v1/public/experiences/${body.slug}`).expect(200);
  });

  it("une révision republiée remplace l'instantané sans consommer de création", async () => {
    const user = await createUser();
    const id = await readyDraft(user, await newRecipient(user, "Lina"));
    const first = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(200);
    const detail = await http().get(`/v1/experiences/${id}`).set(as(user)).expect(200);
    const fields = { ...detail.body.content.fields, finaleSignoff: "Pour toujours" };
    const edited = await http().patch(`/v1/experiences/${id}`).set(as(user)).send({ content: { fields } }).expect(200);
    expect(edited.body.hasUnpublishedChanges).toBe(true);

    const second = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({}).expect(200);
    expect(second.body.slug).toBe(first.body.slug);
    expect(second.body.revision).toBeGreaterThan(first.body.revision);
    const pub = await http().get(`/v1/public/experiences/${first.body.slug}`).expect(200);
    expect(pub.body.payload.fields.finaleSignoff).toBe("Pour toujours");
    const licenses = await http().get("/v1/licenses").set(as(user)).expect(200);
    expect(licenses.body[0].publications.used).toBe(1);
  });

  it("S19 : un signalement traité par l'administration retire l'expérience", async () => {
    const user = await createUser();
    const admin = await createUser();
    await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    const id = await readyDraft(user, await newRecipient(user, "Mira"));
    const { body } = await http().post(`/v1/experiences/${id}/publish`).set(as(user)).send({ useFree: true }).expect(200);

    await http().post(`/v1/public/experiences/${body.slug}/reports`).send({ reason: "scam", details: "Faux cadeau" }).expect(202);
    await http().get("/v1/admin/reports").set(as(user)).expect(403);
    const reports = await http().get("/v1/admin/reports").set(as(admin)).expect(200);
    const report = reports.body.find((r: { experience: { id: string } }) => r.experience.id === id);
    expect(report).toMatchObject({ reason: "scam", status: "open" });

    await http().post(`/v1/admin/reports/${report.id}/resolve`).set(as(admin)).send({ action: "suspend", resolution: "arnaque" }).expect(200);
    await http().get(`/v1/public/experiences/${body.slug}`).expect(404);
    // L'expéditeur ne peut pas lever une suspension en réactivant.
    await http().post(`/v1/experiences/${id}/enable`).set(as(user)).expect(409);
    const twice = await http().post(`/v1/admin/reports/${report.id}/resolve`).set(as(admin)).send({ action: "dismiss" }).expect(409);
    expect(twice.body.error.code).toBe("REPORT_ALREADY_HANDLED");
  });
});

describe("Administration des formules", () => {
  it("crée une formule, fixe un prix, l'historique est conservé", async () => {
    const admin = await createUser();
    await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);
    await http()
      .post("/v1/admin/plans")
      .set(as(admin))
      .send({ code: "SOLO", name: "Solo", isActive: true, isPublic: true, durationDays: 7, publicationsMax: 1, translations: { en: { name: "Single" } } })
      .expect(201);
    await http().post("/v1/admin/plans/SOLO/prices").set(as(admin)).send({ currency: "USD", amount: "5.00" }).expect(201);
    await http().post("/v1/admin/plans/SOLO/prices").set(as(admin)).send({ currency: "USD", amount: "4.50" }).expect(201);

    const plans = await http().get("/v1/plans?lang=en").expect(200);
    expect(plans.body.find((p: { code: string }) => p.code === "SOLO")).toMatchObject({ name: "Single", prices: [{ currency: "USD", amount: "4.50" }] });
    const history = await pg.query<{ n: number }>("select count(*)::int as n from app.plan_prices p join app.plans x on x.id = p.plan_id where x.code = 'SOLO'");
    expect(history.rows[0]!.n).toBe(2);

    await http().patch("/v1/admin/plans/SOLO").set(as(admin)).send({ isPublic: false }).expect(200);
    expect((await http().get("/v1/plans")).body.map((p: { code: string }) => p.code)).not.toContain("SOLO");
  });

  it("chaque geste d'administration est journalisé", async () => {
    const rows = await pg.query<{ action: string }>("select distinct action from app.audit_log where actor_type = 'admin'");
    expect(rows.rows.map((r) => r.action)).toEqual(expect.arrayContaining(["license.granted", "plan.created", "plan.price_set", "report.suspend"]));
  });
});

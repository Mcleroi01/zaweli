/**
 * Écrans de gestion de l'administration (docs/16) : comptes, suspension,
 * licences, modèles, modération. API réelle sur les migrations (PGlite).
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import { coffretV1 } from "@zaweli/template-coffret";
import { manifestHash } from "@zaweli/template-engine/schema";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JwtVerifierService } from "../src/auth/jwt-verifier.service.js";
import { DB } from "../src/database/database.module.js";
import { AuthAdmin } from "../src/me/account.service.js";
import { createTestDatabase } from "./support/pglite.js";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.PUBLIC_WEB_URL = "https://zaweli.test";

class FakeAuthAdmin extends AuthAdmin {
  readonly available = true;
  readonly banned = new Map<string, boolean>();
  async deleteUser() {}
  async anonymizeUser() {}
  async setBanned(id: string, banned: boolean) {
    this.banned.set(id, banned);
  }
}

let app: INestApplication;
let pg: PGlite;
let admin: string;
const authAdmin = new FakeAuthAdmin();
const http = () => request(app.getHttpServer());
const as = (userId: string) => ({ authorization: `Bearer test:${userId}` });

async function account(email: string, name: string | null = null) {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, email]);
  await pg.query("insert into app.profiles (id, display_name) values ($1, $2) on conflict (id) do update set display_name = excluded.display_name", [id, name]);
  return id;
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
  await pg.query("insert into app.template_access_tags (template_id, tag) values ($1, 'free-eligible')", [template.rows[0]!.id]);
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, publications_max, template_access_mode) values ('SOLO', 'Solo', true, true, 30, 1, 'all')`);

  admin = await account("admin@zaweli.test", "Équipe");
  await pg.query("insert into app.user_roles (user_id, role) values ($1, 'admin')", [admin]);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(database.db)
    .overrideProvider(AuthAdmin)
    .useValue(authAdmin)
    .overrideProvider(JwtVerifierService)
    .useValue({ verify: async (token: string) => ({ id: token.split(":")[1]!, email: "x@zaweli.test" }) })
    .compile();
  app = configureApp(moduleRef.createNestApplication());
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pg?.close();
});

describe("Comptes", () => {
  it("recherche par adresse, nom ou identifiant, réservé au rôle admin", async () => {
    const kin = await account("grace.mbuyi@exemple.cd", "Grâce Mbuyi");
    await account("autre@exemple.fr", "Autre");
    await http().get("/v1/admin/users").set(as(kin)).expect(403);
    const byEmail = await http().get("/v1/admin/users?q=mbuyi@").set(as(admin)).expect(200);
    expect(byEmail.body.map((u: { id: string }) => u.id)).toEqual([kin]);
    const byName = await http().get(`/v1/admin/users?q=${encodeURIComponent("Grâce")}`).set(as(admin)).expect(200);
    expect(byName.body[0]).toMatchObject({ id: kin, displayName: "Grâce Mbuyi", roles: [], experiences: 0, paidOrders: 0 });
    expect((await http().get(`/v1/admin/users?q=${kin}`).set(as(admin)).expect(200)).body).toHaveLength(1);
    // Les caractères spéciaux de la recherche ne sont pas des jokers.
    expect((await http().get("/v1/admin/users?q=%25").set(as(admin)).expect(200)).body).toHaveLength(0);
  });

  it("suspend un compte : ses jetons sont refusés, Supabase le bloque ; puis rétablit", async () => {
    const user = await account("suspect@exemple.cd");
    await http().get("/v1/me/profile").set(as(user)).expect(200);
    await http().post(`/v1/admin/users/${user}/suspend`).set(as(admin)).send({ reason: "x" }).expect(400);
    const suspended = await http().post(`/v1/admin/users/${user}/suspend`).set(as(admin)).send({ reason: "Fraude au parrainage" }).expect(200);
    expect(suspended.body).toMatchObject({ suspensionReason: "Fraude au parrainage", suspendedAt: expect.any(String) });
    expect(authAdmin.banned.get(user)).toBe(true);
    expect((await http().get("/v1/me/profile").set(as(user)).expect(403)).body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect((await http().get("/v1/admin/users?status=suspended").set(as(admin)).expect(200)).body.map((u: { id: string }) => u.id)).toContain(user);

    await http().post(`/v1/admin/users/${admin}/suspend`).set(as(admin)).send({ reason: "Essai sur moi-même" }).expect(400);
    const back = await http().post(`/v1/admin/users/${user}/unsuspend`).set(as(admin)).expect(200);
    expect(back.body).toMatchObject({ suspendedAt: null, suspensionReason: null });
    expect(authAdmin.banned.get(user)).toBe(false);
    await http().get("/v1/me/profile").set(as(user)).expect(200);
    const audit = await pg.query<{ action: string }>("select action from app.audit_log where entity_id = $1 order by id", [user]);
    expect(audit.rows.map((r) => r.action)).toEqual(["user.suspended", "user.unsuspended"]);
  });

  it("offre puis retire une licence, visible dans la fiche du compte", async () => {
    const user = await account("client@exemple.cd");
    const granted = await http().post("/v1/admin/licenses").set(as(admin)).send({ userId: user, planCode: "SOLO", reason: "Geste commercial" }).expect(201);
    const detail = await http().get(`/v1/admin/users/${user}`).set(as(admin)).expect(200);
    expect(detail.body.licenses).toEqual([expect.objectContaining({ id: granted.body.id, plan: "Solo", source: "admin_grant", status: "active" })]);
    expect(detail.body.activeLicenses).toBe(1);
    await http().post(`/v1/admin/licenses/${granted.body.id}/revoke`).set(as(admin)).send({ reason: "Erreur d'attribution" }).expect(200);
    await http().post(`/v1/admin/licenses/${granted.body.id}/revoke`).set(as(admin)).send({ reason: "Encore" }).expect(409);
    expect((await http().get(`/v1/admin/users/${user}`).set(as(admin)).expect(200)).body.licenses[0].status).toBe("revoked");
    await http().get(`/v1/admin/users/${randomUUID()}`).set(as(admin)).expect(404);
  });
});

describe("Modèles et modération", () => {
  it("liste les modèles avec versions, étiquettes et usage", async () => {
    const res = await http().get("/v1/admin/templates").set(as(admin)).expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        slug: "coffret",
        status: "published",
        currentVersion: "1.0.0",
        accessTags: ["free-eligible"],
        versions: [expect.objectContaining({ version: "1.0.0", status: "published" })],
        experiences: 0,
      }),
    ]);
    await http().patch("/v1/admin/templates/coffret").set(as(admin)).send({ status: "hidden", accessTags: ["free-eligible", "solo"] }).expect(200);
    expect((await http().get("/v1/admin/templates").set(as(admin)).expect(200)).body[0]).toMatchObject({ status: "hidden", accessTags: expect.arrayContaining(["solo", "free-eligible"]) });
    await http().patch("/v1/admin/templates/coffret").set(as(admin)).send({ status: "published" }).expect(200);
  });

  it("traite un signalement, retire l'expérience, puis la rétablit", async () => {
    const owner = await account("auteur@exemple.cd");
    const recipient = await pg.query<{ id: string }>("insert into app.recipients (owner_id, display_name) values ($1, 'Pauline') returning id", [owner]);
    const tpl = await pg.query<{ id: string; current_version_id: string }>("select id, current_version_id from app.templates where slug = 'coffret'");
    const exp = await pg.query<{ id: string }>(
      `insert into app.experiences (owner_id, template_id, template_version_id, recipient_id, status, slug, content, first_published_at, last_published_at)
       values ($1, $2, $3, $4, 'published', 'AbCdEfGh1234', '{"fields":{}}', now(), now()) returning id`,
      [owner, tpl.rows[0]!.id, tpl.rows[0]!.current_version_id, recipient.rows[0]!.id],
    );
    await http().post("/v1/public/experiences/AbCdEfGh1234/reports").send({ reason: "scam", details: "Demande de l'argent" }).expect(202);
    const open = await http().get("/v1/admin/reports").set(as(admin)).expect(200);
    const report = open.body.find((r: { experience: { id: string } }) => r.experience.id === exp.rows[0]!.id);
    expect(report).toMatchObject({ reason: "scam", status: "open" });
    await http().post(`/v1/admin/reports/${report.id}/resolve`).set(as(admin)).send({ action: "suspend", resolution: "Arnaque confirmée" }).expect(200);
    const suspended = await http().get("/v1/admin/experiences/suspended").set(as(admin)).expect(200);
    expect(suspended.body[0]).toMatchObject({ id: exp.rows[0]!.id, slug: "AbCdEfGh1234", ownerEmail: "auteur@exemple.cd", reason: "Arnaque confirmée" });
    await http().post(`/v1/admin/experiences/${exp.rows[0]!.id}/unsuspend`).set(as(admin)).expect(200);
    expect((await http().get("/v1/admin/experiences/suspended").set(as(admin)).expect(200)).body).toHaveLength(0);
  });
});

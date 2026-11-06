/**
 * Tests de bout en bout contre le VRAI Supabase local (Docker).
 * Prérequis : pnpm db:start puis pnpm env:local.
 *
 * Couvre :
 *  - santé et format d'erreur ;
 *  - authentification réelle (utilisateur Supabase Auth, jeton ES256 vérifié par JWKS) ;
 *  - création automatique du profil par le déclencheur sur auth.users ;
 *  - schéma `app` invisible depuis l'API REST publique de Supabase ;
 *  - S3 : deux publications SIMULTANÉES sur le dernier droit d'une licence.
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";

try {
  process.loadEnvFile();
} catch {
  throw new Error("apps/api/.env introuvable : lance `pnpm db:start` puis `pnpm env:local`.");
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SECRET_KEY = process.env.E2E_SUPABASE_SECRET_KEY!;
const admin = new pg.Pool({ connectionString: process.env.E2E_DATABASE_ADMIN_URL, max: 2 });
const api = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

let app: INestApplication;
let userId = "";
let accessToken = "";
const email = `e2e-${randomUUID()}@zaweli.test`;
const password = `Pw-${randomUUID()}`;
const fixtures: { planId?: string; templateId?: string } = {};

async function auth(path: string, body: unknown, key = SECRET_KEY) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Auth ${path} : ${res.status} ${JSON.stringify(json)}`);
  return json;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication());
  await app.init();

  const user = await auth("admin/users", { email, password, email_confirm: true });
  userId = user.id as string;
  const session = await auth("token?grant_type=password", { email, password });
  accessToken = session.access_token as string;
});

afterAll(async () => {
  if (userId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SECRET_KEY, authorization: `Bearer ${SECRET_KEY}` },
    });
  }
  if (fixtures.templateId) {
    await admin.query("delete from app.template_access_tags where template_id = $1", [fixtures.templateId]);
    await admin.query("delete from app.template_versions where template_id = $1", [fixtures.templateId]);
    await admin.query("delete from app.templates where id = $1", [fixtures.templateId]);
  }
  if (fixtures.planId) await admin.query("delete from app.plans where id = $1", [fixtures.planId]);
  await Promise.all([admin.end(), api.end()]);
  await app?.close();
});

describe("Santé et erreurs", () => {
  it("GET /v1/health répond ok avec la base", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", checks: { database: { status: "ok" } } });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("une route inconnue renvoie le format d'erreur unique", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/nexiste-pas")
      .set("authorization", `Bearer ${accessToken}`)
      .expect(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("les en-têtes de sécurité sont posés", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("Authentification (Supabase Auth réel)", () => {
  it("sans jeton : 401", async () => {
    const res = await request(app.getHttpServer()).get("/v1/me").expect(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("jeton falsifié : 401", async () => {
    const [h, p] = accessToken.split(".");
    const forged = `${h}.${p}.${"A".repeat(86)}`;
    await request(app.getHttpServer()).get("/v1/me").set("authorization", `Bearer ${forged}`).expect(401);
  });

  it("jeton valide : identité et rôles", async () => {
    const res = await request(app.getHttpServer()).get("/v1/me").set("authorization", `Bearer ${accessToken}`).expect(200);
    expect(res.body).toEqual({ id: userId, email, roles: [] });
  });

  it("le profil a été créé par le déclencheur sur auth.users", async () => {
    const { rows } = await admin.query("select id, locale from app.profiles where id = $1", [userId]);
    expect(rows).toEqual([{ id: userId, locale: "fr" }]);
  });
});

describe("Isolation des données", () => {
  it("le schéma app est invisible depuis l'API REST publique de Supabase", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/licenses?select=*`, {
      headers: { apikey: SECRET_KEY, "accept-profile": "app" },
    });
    expect(res.ok).toBe(false);
  });

  it("le rôle de l'API ne peut pas modifier le journal d'audit", async () => {
    await expect(api.query("delete from app.audit_log")).rejects.toThrow(/permission denied/);
  });
});

describe("S3 — publications simultanées (vrai PostgreSQL, 2 connexions)", () => {
  it("une seule des deux publications consomme le dernier droit", async () => {
    const category = await admin.query("select id from app.template_categories where slug = 'anniversaire'");
    const tpl = await api.query(
      "insert into app.templates (slug, name, category_id) values ($1, 'E2E', $2) returning id",
      [`e2e-${Date.now()}`, category.rows[0].id],
    );
    fixtures.templateId = tpl.rows[0].id;
    const version = await api.query(
      `insert into app.template_versions (template_id, version, renderer_key, manifest, manifest_hash)
       values ($1, '1.0.0', $2, '{}', repeat('a', 64)) returning id`,
      [fixtures.templateId, `e2e-${Date.now()}@1.0.0`],
    );
    const plan = await api.query(
      `insert into app.plans (code, name, publications_max, template_access_mode)
       values ($1, 'E2E', 1, 'all') returning id`,
      [`E2E_${Date.now()}`],
    );
    fixtures.planId = plan.rows[0].id;
    const license = await api.query(
      `insert into app.licenses (user_id, plan_id, source, status, starts_at, start_policy, publications_max,
         template_access_mode, edit_policy, max_publications_per_day)
       values ($1, $2, 'admin_grant', 'active', now(), 'immediate', 1, 'all', 'while_valid', 10) returning id`,
      [userId, fixtures.planId],
    );
    const recipient = await api.query(
      "insert into app.recipients (owner_id, display_name) values ($1, 'Pauline') returning id",
      [userId],
    );
    const experiences = await Promise.all(
      [1, 2].map(() =>
        api.query(
          `insert into app.experiences (owner_id, template_id, template_version_id, recipient_id)
           values ($1, $2, $3, $4) returning id`,
          [userId, fixtures.templateId, version.rows[0].id, recipient.rows[0].id],
        ),
      ),
    );

    const [c1, c2] = await Promise.all([api.connect(), api.connect()]);
    try {
      await c1.query("begin");
      await c2.query("begin");
      // c1 verrouille la licence et consomme…
      await c1.query("select app.consume_publication($1, $2, $3)", [userId, license.rows[0].id, experiences[0]!.rows[0].id]);
      // …c2 tente pendant que c1 n'a pas validé : il doit ATTENDRE le verrou.
      const second = c2.query("select app.consume_publication($1, $2, $3)", [userId, license.rows[0].id, experiences[1]!.rows[0].id]);
      const raced = await Promise.race([second.then(() => "fini", () => "fini"), new Promise((r) => setTimeout(() => r("bloqué"), 300))]);
      expect(raced).toBe("bloqué");
      await c1.query("commit");
      await expect(second).rejects.toThrow("LICENSE_PUBLICATION_LIMIT_REACHED");
      await c2.query("rollback");
    } finally {
      c1.release();
      c2.release();
    }

    const used = await api.query("select publications_used from app.licenses where id = $1", [license.rows[0].id]);
    expect(used.rows[0].publications_used).toBe(1);
  });
});

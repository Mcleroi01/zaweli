/**
 * Aide à l'écriture : faux fournisseur, vraies règles de quota (fonctions
 * SQL reserve/settle) sur les migrations réelles.
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import { coffretV1 } from "@zaweli/template-coffret";
import { manifestHash } from "@zaweli/template-engine/schema";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiProvider, type AiMessage } from "../src/ai/ai.provider.js";
import { clean } from "../src/ai/ai.service.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JwtVerifierService } from "../src/auth/jwt-verifier.service.js";
import { DB } from "../src/database/database.module.js";
import { createTestDatabase } from "./support/pglite.js";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.PUBLIC_WEB_URL = "https://zaweli.test";

class FakeProvider extends AiProvider {
  readonly available = true;
  fail = false;
  last: AiMessage[] = [];
  async complete(messages: AiMessage[]) {
    this.last = messages;
    if (this.fail) throw new Error("panne");
    return { text: "« La plus belle surprise, c'est toi, Pauline. »", model: "fake/model", promptTokens: 120, completionTokens: 20 };
  }
}

let app: INestApplication;
let pg: PGlite;
const provider = new FakeProvider();
const http = () => request(app.getHttpServer());
const as = (userId: string) => ({ authorization: `Bearer test:${userId}` });

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
  await pg.query(`insert into app.plans (code, name, is_active, is_public, duration_days, template_access_mode, ai_generations_max) values ('SOLO', 'Solo', true, true, 7, 'all', 2)`);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(database.db)
    .overrideProvider(AiProvider)
    .useValue(provider)
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

async function draftWithQuota(quota: boolean) {
  const user = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [user, `${user}@zaweli.test`]);
  if (quota) {
    await pg.query(
      `insert into app.licenses (user_id, plan_id, source, status, starts_at, ends_at, start_policy, template_access_mode, edit_policy, max_publications_per_day, ai_generations_max)
       select $1, id, 'admin_grant', 'active', now(), now() + interval '7 days', 'immediate', 'all', 'while_valid', 20, 2 from app.plans where code = 'SOLO'`,
      [user],
    );
  }
  const recipient = await http().post("/v1/recipients").set(as(user)).send({ displayName: "Pauline" }).expect(201);
  const draft = await http().post("/v1/experiences").set(as(user)).send({ templateSlug: "coffret", recipientId: recipient.body.id }).expect(201);
  return { user, experienceId: draft.body.id as string };
}

describe("Aide à l'écriture", () => {
  it("nettoie la proposition et respecte la longueur du champ", () => {
    expect(clean("« Bonjour toi »", 60)).toBe("Bonjour toi");
    expect(clean("un deux trois quatre cinq six", 16)).toBe("un deux trois");
  });

  it("propose un texte sur un champ autorisé et décompte le quota", async () => {
    const { user, experienceId } = await draftWithQuota(true);
    const res = await http().post("/v1/ai/suggest").set(as(user)).send({ experienceId, fieldId: "jewelReveal", tone: "tender", hint: "Elle adore le fleuve" }).expect(200);
    expect(res.body).toEqual({ text: "La plus belle surprise, c'est toi, Pauline.", remaining: 1 });
    // Le prénom, le ton et la précision sont transmis ; rien n'est enregistré dans le brouillon.
    const prompt = provider.last.map((m) => m.content).join("\n");
    expect(prompt).toContain("Pauline");
    expect(prompt).toContain("tendre");
    expect(prompt).toContain("Elle adore le fleuve");
    const draft = await http().get(`/v1/experiences/${experienceId}`).set(as(user)).expect(200);
    expect(draft.body.content.fields.jewelReveal).toBeUndefined();
    const used = await pg.query<{ ai_generations_used: number }>("select ai_generations_used from app.licenses where user_id = $1", [user]);
    expect(used.rows[0]!.ai_generations_used).toBe(1);
  });

  it("ne décompte pas une suggestion qui échoue", async () => {
    const { user, experienceId } = await draftWithQuota(true);
    provider.fail = true;
    await http().post("/v1/ai/suggest").set(as(user)).send({ experienceId, fieldId: "jewelReveal", tone: "funny" }).expect(503);
    provider.fail = false;
    const used = await pg.query<{ ai_generations_used: number }>("select ai_generations_used from app.licenses where user_id = $1", [user]);
    expect(used.rows[0]!.ai_generations_used).toBe(0);
  });

  it("refuse les champs non prévus et l'absence de quota", async () => {
    const { user, experienceId } = await draftWithQuota(true);
    expect((await http().post("/v1/ai/suggest").set(as(user)).send({ experienceId, fieldId: "name", tone: "tender" }).expect(422)).body.error.code).toBe("AI_FIELD_NOT_ALLOWED");
    const poor = await draftWithQuota(false);
    expect((await http().post("/v1/ai/suggest").set(as(poor.user)).send({ experienceId: poor.experienceId, fieldId: "jewelReveal", tone: "tender" }).expect(409)).body.error.code).toBe("AI_QUOTA_EXCEEDED");
    // Le brouillon d'un autre compte reste inaccessible.
    await http().post("/v1/ai/suggest").set(as(poor.user)).send({ experienceId, fieldId: "jewelReveal", tone: "tender" }).expect(404);
  });
});

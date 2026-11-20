/**
 * Photos : l'API réelle (PGlite, vraies migrations) avec un stockage en
 * mémoire à la place de Supabase Storage, et un vrai traitement d'image
 * (sharp) sur un JPEG qui porte des coordonnées GPS dans son EXIF.
 */
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import { coffretV1 } from "@zaweli/template-coffret";
import { manifestHash } from "@zaweli/template-engine/schema";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { JwtVerifierService } from "../src/auth/jwt-verifier.service.js";
import { DB } from "../src/database/database.module.js";
import { sniffImage } from "../src/media/media.service.js";
import { type Bucket, StorageService } from "../src/media/storage.service.js";
import { createTestDatabase } from "./support/pglite.js";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.PUBLIC_WEB_URL = "https://zaweli.test";

/** Stockage en mémoire : mêmes opérations que Supabase Storage. */
class MemoryStorage extends StorageService {
  readonly available = true;
  readonly files = new Map<string, Buffer>();
  private key = (bucket: Bucket, path: string) => `${bucket}/${path}`;
  async signedUploadUrl(bucket: Bucket, path: string) {
    return `https://storage.test/upload/${bucket}/${path}?token=t`;
  }
  async download(bucket: Bucket, path: string) {
    return this.files.get(this.key(bucket, path)) ?? null;
  }
  async upload(bucket: Bucket, path: string, body: Buffer) {
    this.files.set(this.key(bucket, path), body);
  }
  async copy(from: { bucket: Bucket; path: string }, to: { bucket: Bucket; path: string }) {
    const data = this.files.get(this.key(from.bucket, from.path));
    if (!data) throw new Error("source absente");
    this.files.set(this.key(to.bucket, to.path), data);
  }
  async signedReadUrl(bucket: Bucket, path: string) {
    return `https://storage.test/read/${bucket}/${path}?token=r`;
  }
  async remove(bucket: Bucket, paths: string[]) {
    for (const p of paths) this.files.delete(this.key(bucket, p));
  }
  publicUrl(bucket: "published", path: string) {
    return `https://cdn.test/${bucket}/${path}`;
  }
}

let app: INestApplication;
let pg: PGlite;
const storage = new MemoryStorage();
const http = () => request(app.getHttpServer());
const as = (userId: string) => ({ authorization: `Bearer test:${userId}` });

/** JPEG 3000×2000 orienté (EXIF Orientation = 6 : à tourner de 90°) avec des coordonnées GPS. */
async function photoWithGps() {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 180, g: 40, b: 60 } } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "Téléphone" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "4/1 19/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "15/1 18/1 0/1" } })
    .toBuffer();
}

async function draftFor(userId: string) {
  const recipient = await http().post("/v1/recipients").set(as(userId)).send({ displayName: "Pauline" }).expect(201);
  const created = await http().post("/v1/experiences").set(as(userId)).send({ templateSlug: "coffret", recipientId: recipient.body.id }).expect(201);
  return created.body.id as string;
}

/** Le navigateur dépose le fichier à l'adresse signée : ici, directement dans le stockage en mémoire. */
async function uploadAs(userId: string, experienceId: string, file: Buffer, mime = "image/jpeg") {
  const res = await http().post("/v1/media/uploads").set(as(userId)).send({ experienceId, mime, size: file.length }).expect(201);
  expect(res.body.uploadUrl).toBe(`https://storage.test/upload/uploads/${userId}/${res.body.mediaId}?token=t`);
  await storage.upload("uploads", `${userId}/${res.body.mediaId}`, file);
  return res.body.mediaId as string;
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

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(database.db)
    .overrideProvider(StorageService)
    .useValue(storage)
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

async function newUser() {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, `${id}@zaweli.test`]);
  return id;
}

describe("Photos", () => {
  it("reconnaît le vrai type d'un fichier par sa signature", async () => {
    expect(sniffImage(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer())).toBe("image/png");
    expect(sniffImage(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).webp().toBuffer())).toBe("image/webp");
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("convertit en WebP, redresse l'image et supprime l'EXIF et le GPS", async () => {
    const user = await newUser();
    const experienceId = await draftFor(user);
    const original = await photoWithGps();
    const before = await sharp(original).metadata();
    expect(before.exif).toBeDefined();
    expect(before.orientation).toBe(6);

    const mediaId = await uploadAs(user, experienceId, original);
    const done = await http().post(`/v1/media/${mediaId}/complete`).set(as(user)).expect(200);
    // Orientation 6 appliquée : l'image devient verticale ; « lg » limitée à 1600 px de large.
    expect(done.body).toMatchObject({ id: mediaId, status: "ready", width: 1600, height: 2400 });
    expect(done.body.urls.md).toBe(`https://storage.test/read/media/${user}/${mediaId}/md.webp?token=r`);

    for (const [name, width] of [["sm", 480], ["md", 960], ["lg", 1600]] as const) {
      const out = storage.files.get(`media/${user}/${mediaId}/${name}.webp`)!;
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(width);
      expect(meta.exif).toBeUndefined();
    }
    // Le fichier d'origine, avec son EXIF, n'est pas conservé.
    expect(storage.files.has(`uploads/${user}/${mediaId}`)).toBe(false);

    // Rejouer « complete » ne retraite pas.
    await http().post(`/v1/media/${mediaId}/complete`).set(as(user)).expect(200);
  }, 30_000);

  it("refuse un faux fichier image, sans garder le fichier envoyé", async () => {
    const user = await newUser();
    const experienceId = await draftFor(user);
    const mediaId = await uploadAs(user, experienceId, Buffer.from("<html><script>alert(1)</script></html>"));
    const refused = await http().post(`/v1/media/${mediaId}/complete`).set(as(user)).expect(422);
    expect(refused.body.error).toMatchObject({ code: "MEDIA_REJECTED", details: { reason: "not_an_image" } });
    expect(storage.files.has(`uploads/${user}/${mediaId}`)).toBe(false);
  });

  it("protège les photos des autres comptes", async () => {
    const owner = await newUser();
    const other = await newUser();
    const experienceId = await draftFor(owner);
    await http().post("/v1/media/uploads").set(as(other)).send({ experienceId, mime: "image/jpeg", size: 1000 }).expect(404);
    const mediaId = await uploadAs(owner, experienceId, await photoWithGps());
    await http().post(`/v1/media/${mediaId}/complete`).set(as(other)).expect(404);
    await http().post(`/v1/media/${mediaId}/complete`).set(as(owner)).expect(200);
    const urls = await http().post("/v1/media/urls").set(as(other)).send({ ids: [mediaId] }).expect(200);
    expect(urls.body).toEqual({});
    await http().delete(`/v1/media/${mediaId}`).set(as(other)).expect(404);
  });

  it("publie une expérience avec ses photos : copies publiques sous des chemins aléatoires", async () => {
    const user = await newUser();
    const experienceId = await draftFor(user);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const mediaId = await uploadAs(user, experienceId, await photoWithGps());
      await http().post(`/v1/media/${mediaId}/complete`).set(as(user)).expect(200);
      ids.push(mediaId);
    }
    const photo = (mediaId: string) => ({ mediaId, alt: "Une photo de nous" });
    await http()
      .patch(`/v1/experiences/${experienceId}`)
      .set(as(user))
      .send({
        content: {
          fields: {
            name: "Pauline",
            sealCard: "Aujourd'hui, tout ce qui se trouve ici t'appartient.",
            sealCta: "Je suis prête",
            jewelTitle: "Un écrin pour toi",
            jewelPhoto: photo(ids[0]!),
            jewelReveal: "La plus belle, c'est toi.",
            riddles: [{ question: "Où nous sommes-nous rencontrés ?", choices: ["Kinshasa", "Paris", "Lubumbashi"], answer: 0, photo: photo(ids[1]!), reveal: "À Kinshasa, bien sûr." }],
            giftsTitle: "Tes cadeaux",
            celebrationPhoto: photo(ids[2]!),
            wishes: ["joie", "amour", "rires", "voyages", "santé", "paix", "audace", "douceur"],
            wishesDone: "Tous tes vœux sont lâchés.",
            finalePhoto: photo(ids[3]!),
            finaleLine: "Joyeux anniversaire.",
            finaleLetter: "Merci d'être exactement toi, chaque jour de l'année.",
            finaleSignoff: "Avec amour",
          },
          disabledSections: ["gifts"],
        },
      })
      .expect(200);
    const published = await http().post(`/v1/experiences/${experienceId}/publish`).set(as(user)).send({ useFree: true });
    expect(published.status, JSON.stringify(published.body)).toBe(200);

    const page = await http().get(`/v1/public/experiences/${published.body.slug}`).expect(200);
    const text = JSON.stringify(page.body.payload);
    const urls = [...text.matchAll(/https:\/\/cdn\.test\/published\/([0-9a-f-]{36})\/lg\.webp/g)];
    expect(urls).toHaveLength(4);
    // Aucun identifiant de compte dans les adresses publiques.
    expect(text).not.toContain(user);
    for (const [, folder] of urls) expect(storage.files.has(`published/${folder}/lg.webp`)).toBe(true);
  }, 60_000);
});

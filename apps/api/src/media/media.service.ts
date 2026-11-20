import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { type CreateMediaUploadRequest, MEDIA_MAX_BYTES, type MediaResponse, type MediaUploadResponse, type MediaUrlsResponse } from "@zaweli/shared-types";
import type { TemplateManifest } from "@zaweli/template-engine/schema";
import sharp from "sharp";
import { ApiException } from "../common/api-exception.js";
import { DB } from "../database/database.module.js";
import { audit, type Db, inTransaction } from "../database/transaction.js";
import { StorageService } from "./storage.service.js";

type Ctx = { userId: string; requestId: string | null };

/** Largeurs des variantes WebP (chaque image est réduite, jamais agrandie). */
export const VARIANTS = { sm: 480, md: 960, lg: 1600 } as const;
const READ_URL_SECONDS = 3600;
/** Au-delà, l'image est refusée (bombe de décompression). */
const MAX_PIXELS = 60_000_000;

/** Vrai type d'un fichier d'après sa signature, pas d'après son extension ni ce que dit le navigateur. */
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Photos des brouillons et des expériences publiées (§7.8, A11).
 *
 * 1. `createUpload` : réserve la photo et donne une adresse d'envoi signée.
 * 2. Le navigateur y dépose le fichier (bucket privé « uploads »).
 * 3. `complete` : contrôle du vrai type et de la taille, redressement selon
 *    l'orientation, conversion WebP en 3 tailles SANS métadonnées (EXIF, GPS),
 *    rangement dans le bucket privé « media », suppression du fichier brut.
 * 4. `ensurePublished` (à la publication) : copie vers le bucket public
 *    « published », sous un chemin aléatoire sans lien avec le compte.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger("Media");

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async createUpload(ctx: Ctx, body: CreateMediaUploadRequest): Promise<MediaUploadResponse> {
    if (!this.storage.available) throw new ApiException("MEDIA_UNAVAILABLE");
    const experience = await this.db
      .selectFrom("app.experiences as e")
      .innerJoin("app.template_versions as tv", "tv.id", "e.template_version_id")
      .select(["e.id", "e.status", "tv.manifest"])
      .where("e.id", "=", body.experienceId)
      .where("e.owner_id", "=", ctx.userId)
      .where("e.status", "in", ["draft", "published", "disabled"])
      .executeTakeFirst();
    if (!experience) throw new ApiException("EXPERIENCE_NOT_FOUND");
    // Garde-fou contre l'accumulation : le plafond du modèle, plus une marge pour les remplacements.
    const max = ((experience.manifest as unknown as TemplateManifest).media?.maxPhotos ?? 10) * 3;
    const { count } = await this.db
      .selectFrom("app.media_assets")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("experience_id", "=", body.experienceId)
      .where("status", "!=", "deleted")
      .executeTakeFirstOrThrow();
    if (Number(count) >= max) throw new ApiException("MEDIA_LIMIT_REACHED", { max });

    const id = randomUUID();
    const path = `${ctx.userId}/${id}`;
    await this.db
      .insertInto("app.media_assets")
      .values({ id, owner_id: ctx.userId, experience_id: body.experienceId, upload_path: path, declared_mime: body.mime, declared_size_bytes: body.size })
      .execute();
    return { mediaId: id, uploadUrl: await this.storage.signedUploadUrl("uploads", path) };
  }

  async complete(ctx: Ctx, mediaId: string): Promise<MediaResponse> {
    if (!this.storage.available) throw new ApiException("MEDIA_UNAVAILABLE");
    const claimed = await inTransaction(this.db, "user", ctx.userId, async (trx) => {
      const row = await trx
        .selectFrom("app.media_assets")
        .select(["id", "status", "upload_path"])
        .where("id", "=", mediaId)
        .where("owner_id", "=", ctx.userId)
        .forUpdate()
        .executeTakeFirst();
      if (!row || row.status === "deleted") throw new ApiException("MEDIA_NOT_FOUND");
      if (row.status !== "pending_upload") return null;
      await trx.updateTable("app.media_assets").set({ status: "processing" }).where("id", "=", mediaId).execute();
      return row;
    });
    if (!claimed) return this.describe(ctx.userId, mediaId);

    const raw = await this.storage.download("uploads", claimed.upload_path);
    try {
      if (!raw) throw new Rejection("upload_missing");
      if (raw.length > MEDIA_MAX_BYTES) throw new Rejection("too_large");
      const detected = sniffImage(raw);
      if (!detected) throw new Rejection("not_an_image");
      const meta = await sharp(raw, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
      if (!meta?.width || !meta.height) throw new Rejection("unreadable");

      const variants: Record<string, string> = {};
      let size = { width: 0, height: 0 };
      for (const [name, width] of Object.entries(VARIANTS)) {
        // rotate() redresse selon l'EXIF ; sharp n'écrit aucune métadonnée en sortie (sans withMetadata).
        const { data, info } = await sharp(raw, { limitInputPixels: MAX_PIXELS })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        const path = `${ctx.userId}/${mediaId}/${name}.webp`;
        await this.storage.upload("media", path, data, "image/webp");
        variants[name] = path;
        if (name === "lg") size = { width: info.width, height: info.height };
      }
      await this.db
        .updateTable("app.media_assets")
        .set({ status: "ready", detected_mime: detected, width: size.width, height: size.height, variants: JSON.stringify(variants), processed_at: new Date() })
        .where("id", "=", mediaId)
        .execute();
    } catch (e) {
      const reason = e instanceof Rejection ? e.message : "processing_failed";
      if (!(e instanceof Rejection)) this.logger.warn(`traitement ${mediaId} : ${(e as Error).message}`);
      await this.db.updateTable("app.media_assets").set({ status: "rejected", rejection_reason: reason, processed_at: new Date() }).where("id", "=", mediaId).execute();
      await this.storage.remove("uploads", [claimed.upload_path]).catch(() => undefined);
      throw new ApiException("MEDIA_REJECTED", { reason });
    }
    // Le fichier d'origine (avec son EXIF) ne reste pas stocké.
    await this.storage.remove("uploads", [claimed.upload_path]).catch((e: unknown) => this.logger.warn(`suppression ${mediaId} : ${(e as Error).message}`));
    await audit(this.db, { actorType: "user", actorId: ctx.userId, action: "media.processed", entityType: "media", entityId: mediaId, requestId: ctx.requestId });
    return this.describe(ctx.userId, mediaId);
  }

  async urls(userId: string, ids: string[]): Promise<MediaUrlsResponse> {
    const out: MediaUrlsResponse = {};
    for (const id of new Set(ids)) {
      try {
        out[id] = await this.describe(userId, id);
      } catch {
        // Photo d'un autre compte ou supprimée : simplement absente de la réponse.
      }
    }
    return out;
  }

  async remove(ctx: Ctx, mediaId: string): Promise<void> {
    const row = await this.db
      .updateTable("app.media_assets")
      .set({ status: "deleted", deleted_at: new Date() })
      .where("id", "=", mediaId)
      .where("owner_id", "=", ctx.userId)
      .where("status", "!=", "deleted")
      // Une photo déjà publiée reste servie aux destinataires : on ne retire que ses variantes privées.
      .returning(["variants"])
      .executeTakeFirst();
    if (!row) throw new ApiException("MEDIA_NOT_FOUND");
    await this.storage.remove("media", Object.values(row.variants ?? {})).catch(() => undefined);
  }

  /**
   * Avant une publication : chaque photo prête reçoit sa copie publique
   * (chemin aléatoire), si elle ne l'a pas déjà.
   */
  async ensurePublished(userId: string, mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0 || !this.storage.available) return;
    const rows = await this.db
      .selectFrom("app.media_assets")
      .select(["id", "variants", "published_variants"])
      .where("id", "in", mediaIds)
      .where("owner_id", "=", userId)
      .where("status", "=", "ready")
      .execute();
    for (const row of rows) {
      if (row.published_variants?.lg) continue;
      const folder = randomUUID();
      const published: Record<string, string> = {};
      for (const [name, path] of Object.entries(row.variants ?? {})) {
        const target = `${folder}/${name}.webp`;
        await this.storage.copy({ bucket: "media", path }, { bucket: "published", path: target });
        published[name] = this.storage.publicUrl("published", target);
      }
      await this.db.updateTable("app.media_assets").set({ published_variants: JSON.stringify(published) }).where("id", "=", row.id).execute();
    }
  }

  /** Photos prêtes d'un brouillon, en adresses temporaires (aperçu réservé à l'expéditeur). */
  async previewPhotos(userId: string, mediaIds: string[]): Promise<Map<string, { src: string; width?: number; height?: number }>> {
    const map = new Map<string, { src: string; width?: number; height?: number }>();
    if (mediaIds.length === 0 || !this.storage.available) return map;
    const rows = await this.db
      .selectFrom("app.media_assets")
      .select(["id", "variants", "width", "height"])
      .where("id", "in", mediaIds)
      .where("owner_id", "=", userId)
      .where("status", "=", "ready")
      .execute();
    for (const row of rows) {
      const path = row.variants?.lg ?? row.variants?.md;
      if (!path) continue;
      map.set(row.id, { src: await this.storage.signedReadUrl("media", path, READ_URL_SECONDS), width: row.width ?? undefined, height: row.height ?? undefined });
    }
    return map;
  }

  private async describe(userId: string, mediaId: string): Promise<MediaResponse> {
    const row = await this.db
      .selectFrom("app.media_assets")
      .select(["id", "status", "width", "height", "variants"])
      .where("id", "=", mediaId)
      .where("owner_id", "=", userId)
      .executeTakeFirst();
    if (!row || row.status === "deleted") throw new ApiException("MEDIA_NOT_FOUND");
    let urls: MediaResponse["urls"] = null;
    if (row.status === "ready" && row.variants?.lg) {
      const [sm, md, lg] = await Promise.all(
        (["sm", "md", "lg"] as const).map((k) => this.storage.signedReadUrl("media", row.variants[k] ?? row.variants.lg!, READ_URL_SECONDS)),
      );
      urls = { sm: sm!, md: md!, lg: lg! };
    }
    return { id: row.id, status: row.status, width: row.width, height: row.height, urls };
  }
}

class Rejection extends Error {}

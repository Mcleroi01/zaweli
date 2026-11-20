import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../config/env.js";

export type Bucket = "uploads" | "media" | "published";

/**
 * Stockage des fichiers (architecture A11). Interface abstraite : les tests
 * branchent un stockage en mémoire, la production Supabase Storage.
 */
export abstract class StorageService {
  abstract readonly available: boolean;
  /** Adresse d'envoi signée : le navigateur y dépose le fichier sans passer par l'API. */
  abstract signedUploadUrl(bucket: Bucket, path: string): Promise<string>;
  abstract download(bucket: Bucket, path: string): Promise<Buffer | null>;
  abstract upload(bucket: Bucket, path: string, body: Buffer, contentType: string): Promise<void>;
  abstract copy(from: { bucket: Bucket; path: string }, to: { bucket: Bucket; path: string }): Promise<void>;
  /** Lecture temporaire d'un fichier privé (vignettes du brouillon). */
  abstract signedReadUrl(bucket: Bucket, path: string, seconds: number): Promise<string>;
  abstract remove(bucket: Bucket, paths: string[]): Promise<void>;
  abstract publicUrl(bucket: "published", path: string): string;
}

/** Supabase Storage, appelé avec la clé secrète du projet (côté serveur uniquement). */
@Injectable()
export class SupabaseStorage extends StorageService {
  readonly available: boolean;
  private readonly base: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    this.available = Boolean(env.SUPABASE_SECRET_KEY);
    this.base = `${env.SUPABASE_URL.replace(/\/+$/, "")}/storage/v1`;
  }

  async signedUploadUrl(bucket: Bucket, path: string): Promise<string> {
    const res = await this.call("POST", `/object/upload/sign/${bucket}/${path}`);
    const { url } = (await res.json()) as { url: string };
    return `${this.base}${url}`;
  }

  async download(bucket: Bucket, path: string): Promise<Buffer | null> {
    const res = await this.call("GET", `/object/${bucket}/${path}`, undefined, true);
    if (res.status === 400 || res.status === 404) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  async upload(bucket: Bucket, path: string, body: Buffer, contentType: string): Promise<void> {
    await this.call("POST", `/object/${bucket}/${path}`, body, false, { "content-type": contentType, "x-upsert": "true", "cache-control": "31536000" });
  }

  async copy(from: { bucket: Bucket; path: string }, to: { bucket: Bucket; path: string }): Promise<void> {
    await this.call("POST", "/object/copy", JSON.stringify({ bucketId: from.bucket, sourceKey: from.path, destinationBucket: to.bucket, destinationKey: to.path }), false, {
      "content-type": "application/json",
    });
  }

  async signedReadUrl(bucket: Bucket, path: string, seconds: number): Promise<string> {
    const res = await this.call("POST", `/object/sign/${bucket}/${path}`, JSON.stringify({ expiresIn: seconds }), false, { "content-type": "application/json" });
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${this.base}${signedURL}`;
  }

  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.call("DELETE", `/object/${bucket}`, JSON.stringify({ prefixes: paths }), false, { "content-type": "application/json" });
  }

  publicUrl(bucket: "published", path: string): string {
    return `${this.base}/object/public/${bucket}/${path}`;
  }

  private async call(method: string, path: string, body?: Buffer | string, allowMissing = false, headers: Record<string, string> = {}): Promise<Response> {
    const key = this.env.SUPABASE_SECRET_KEY;
    if (!key) throw new Error("storage_not_configured");
    const init: RequestInit = { method, headers: { authorization: `Bearer ${key}`, apikey: key, ...headers }, signal: AbortSignal.timeout(30_000) };
    if (body !== undefined) init.body = body as BodyInit;
    const res = await fetch(`${this.base}${path}`, init);
    if (!res.ok && !(allowMissing && (res.status === 400 || res.status === 404))) {
      throw new Error(`storage ${method} ${path.split("/").slice(0, 3).join("/")} → ${res.status}`);
    }
    return res;
  }
}

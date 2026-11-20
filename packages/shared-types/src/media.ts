import { z } from "zod";

/**
 * Photos des expériences (cahier des charges §7.8, architecture A11).
 *
 * Le navigateur dépose le fichier sur une adresse d'envoi signée, puis
 * demande le traitement : contrôle du vrai type, conversion en WebP en trois
 * tailles, métadonnées EXIF (position GPS) supprimées.
 * HEIC n'est pas accepté côté serveur : les téléphones le convertissent en
 * JPEG quand la page n'accepte que JPEG, PNG et WebP.
 */
export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export const createMediaUploadSchema = z.strictObject({
  experienceId: z.uuid(),
  mime: z.enum(MEDIA_MIME_TYPES),
  size: z.number().int().positive().max(MEDIA_MAX_BYTES),
});
export type CreateMediaUploadRequest = z.infer<typeof createMediaUploadSchema>;

export type MediaUploadResponse = { mediaId: string; uploadUrl: string };

export type MediaResponse = {
  id: string;
  status: "pending_upload" | "processing" | "ready" | "rejected" | "deleted";
  width: number | null;
  height: number | null;
  /** Adresses temporaires (1 h) des variantes privées, pour les vignettes du brouillon. */
  urls: { sm: string; md: string; lg: string } | null;
};

export const mediaUrlsSchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(60) });
export type MediaUrlsRequest = z.infer<typeof mediaUrlsSchema>;
export type MediaUrlsResponse = Record<string, MediaResponse>;

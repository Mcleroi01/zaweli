/**
 * Charge PUBLIQUE d'une expérience publiée : ce que le navigateur du
 * destinataire reçoit (experience_snapshots.public_payload).
 *
 * Construite côté serveur à la publication à partir du contenu validé :
 *  - les photos deviennent des URLs publiées + texte alternatif ;
 *  - les cadeaux deviennent leur vue publique (champs protégés retirés) ;
 *  - la bonne réponse d'une énigme devient une EMPREINTE (classe affective :
 *    obfuscation contre la lecture du code source, pas une protection de
 *    valeur — une énigme qui protège une valeur se valide côté serveur).
 */
import type { Locale, MusicChoice } from "@zaweli/shared-types";
import type { CompiledContent } from "./compile.js";
import type { PublicGift } from "./gifts.js";
import type { TemplateManifest } from "./manifest.js";

export type PublicPhoto = { src: string; alt: string; width?: number; height?: number };

export type PublicRiddle = {
  question: string;
  choices: string[];
  /** SHA-256 hex de `${salt}:${index de l'énigme}:${index de la bonne proposition}`. */
  answerHash: string;
  hint?: string;
  photo?: PublicPhoto;
  reveal: string;
};

export type PublicCaptionedPhoto = PublicPhoto & { caption?: string };

export type PublicFieldValue =
  | string
  | number
  | boolean
  | string[]
  | PublicPhoto
  | PublicRiddle[]
  | PublicGift[]
  | PublicCaptionedPhoto[]
  | Array<{ title: string; text: string }>;

export type PublicPayload = {
  schema: 1;
  rendererKey: string;
  fields: Record<string, PublicFieldValue>;
  disabledSections: string[];
  /** Sel propre à l'instantané, pour les empreintes de réponses. */
  salt: string;
  /** Langue des textes fixes du template (absente des anciens instantanés : français). */
  locale?: Locale;
  /** Musique choisie par l'expéditeur (référence Audius), lancée au premier geste du destinataire. */
  music?: MusicChoice;
};

export async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const riddleAnswerHash = (salt: string, riddleIndex: number, choiceIndex: number) =>
  sha256Hex(`${salt}:${riddleIndex}:${choiceIndex}`);

/** Vérifie une proposition côté navigateur (classe affective uniquement). */
export async function checkRiddleAnswer(payload: Pick<PublicPayload, "salt">, riddleIndex: number, riddle: PublicRiddle, choiceIndex: number) {
  return (await riddleAnswerHash(payload.salt, riddleIndex, choiceIndex)) === riddle.answerHash;
}

export type PayloadContext = {
  /** Résout un média (app.media_assets) vers son URL publiée. */
  resolvePhoto: (mediaId: string) => { src: string; width?: number; height?: number };
  /** Cadeaux de l'expérience (app.gifts), déjà réduits à leur vue publique. */
  gifts: PublicGift[];
  /** Sel aléatoire, généré une fois par instantané. */
  salt: string;
  /** Langue choisie par l'expéditeur pour l'expérience. */
  locale?: Locale;
};

/** Construit la charge publique. Le contenu DOIT avoir été validé en mode "publish". */
export async function buildPublicPayload(
  manifest: TemplateManifest,
  content: CompiledContent,
  ctx: PayloadContext,
): Promise<PublicPayload> {
  const fields: Record<string, PublicFieldValue> = {};
  const giftsById = new Map(ctx.gifts.map((g) => [g.id, g]));

  for (const [id, def] of Object.entries(manifest.fields)) {
    const value = (content.fields as Record<string, unknown>)[id];
    if (value === undefined) continue;

    switch (def.kind) {
      case "photo": {
        const v = value as { mediaId: string; alt: string };
        fields[id] = { ...ctx.resolvePhoto(v.mediaId), alt: v.alt };
        break;
      }
      case "photoList": {
        const photos = value as Array<{ mediaId: string; alt: string; caption?: string }>;
        fields[id] = photos.map((v) => ({ ...ctx.resolvePhoto(v.mediaId), alt: v.alt, ...(v.caption ? { caption: v.caption } : {}) }));
        break;
      }
      case "giftList": {
        fields[id] = (value as string[]).map((giftId) => {
          const gift = giftsById.get(giftId);
          if (!gift) throw new Error(`cadeau introuvable : ${giftId}`);
          if (!def.types.includes(gift.type)) throw new Error(`type de cadeau non accepté par ${id} : ${gift.type}`);
          return gift;
        });
        break;
      }
      case "riddleList": {
        const riddles = value as Array<{
          question: string;
          choices: string[];
          answer: number;
          hint?: string;
          photo?: { mediaId: string; alt: string };
          reveal: string;
        }>;
        fields[id] = await Promise.all(
          riddles.map(async (r, index) => ({
            question: r.question,
            choices: r.choices,
            answerHash: await riddleAnswerHash(ctx.salt, index, r.answer),
            ...(r.hint ? { hint: r.hint } : {}),
            ...(r.photo ? { photo: { ...ctx.resolvePhoto(r.photo.mediaId), alt: r.photo.alt } } : {}),
            reveal: r.reveal,
          })),
        );
        break;
      }
      default:
        fields[id] = value as PublicFieldValue;
    }
  }

  return {
    schema: 1,
    rendererKey: manifest.rendererKey,
    fields,
    disabledSections: content.disabledSections,
    salt: ctx.salt,
    ...(ctx.locale ? { locale: ctx.locale } : {}),
  };
}

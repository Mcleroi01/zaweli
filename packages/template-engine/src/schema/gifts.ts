/**
 * Registre des types de cadeaux (cahier des charges §9, architecture A9).
 *
 * Ajouter un type = enregistrer une définition ici (schéma des champs,
 * champs protégés, formulation) et les lignes SQL correspondantes
 * (gift_types, gift_type_statuses, gift_status_transitions).
 * Aucun template existant n'a besoin d'être modifié.
 */
import { z } from "zod";
import { currencySchema, type GiftType } from "@zaweli/shared-types";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date AAAA-MM-JJ");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "heure HH:MM");

/** Lien cartographique : https uniquement, domaines connus. */
const mapUrl = z
  .url({ protocol: /^https$/ })
  .refine(
    (u) => /^(www\.)?(google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|openstreetmap\.org|maps\.apple\.com|waze\.com)$/.test(new URL(u).hostname),
    "domaine de carte non autorisé",
  );

export const giftDataSchemas = {
  MONEY: z.strictObject({
    amount: z.number().positive().max(1_000_000_000),
    currency: currencySchema,
    message: optionalText(240),
    receptionMode: z.enum(["in_person", "sender_mobile_money", "other"]),
  }),
  PHYSICAL: z.strictObject({
    name: text(80),
    description: optionalText(240),
    message: optionalText(240),
    handover: optionalText(160),
  }),
  INVITATION: z.strictObject({
    title: text(80),
    place: text(120),
    date: isoDate,
    time: hhmm.optional(),
    message: optionalText(240),
    practicalInfo: optionalText(240),
    address: optionalText(200),
    mapUrl: mapUrl.optional(),
  }),
  VOUCHER: z.strictObject({
    title: text(80),
    issuer: optionalText(80),
    value: optionalText(40),
    validUntil: isoDate.optional(),
    conditions: optionalText(240),
    message: optionalText(240),
  }),
  EXPERIENCE: z.strictObject({
    title: text(80),
    description: optionalText(240),
    date: optionalText(60),
    place: optionalText(120),
    message: optionalText(240),
  }),
} satisfies Record<GiftType, z.ZodType>;

/** Champs stockés à part (gifts.protected_data), jamais dans la charge publique. */
export const giftProtectedSchemas = {
  VOUCHER: z.strictObject({ code: text(60) }),
} satisfies Partial<Record<GiftType, z.ZodType>>;

export type GiftData<T extends GiftType = GiftType> = z.infer<(typeof giftDataSchemas)[T]>;

/** Vue publique d'un cadeau, telle que livrée au navigateur du destinataire. */
export type PublicGift = {
  [T in GiftType]: { id: string; type: T; status: string; data: GiftData<T> };
}[GiftType];

const RECEPTION: Record<GiftData<"MONEY">["receptionMode"], string> = {
  in_person: "Remis en main propre",
  sender_mobile_money: "Envoyé par mobile money",
  other: "Modalité convenue ensemble",
};

const formatAmount = (amount: number, currency: string) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

export type GiftDescription = {
  /** Petite ligne au-dessus (« Bon pour », « Je t'invite »…). */
  kicker: string;
  title: string;
  lines: string[];
  message?: string;
  /** Mention de vérité affichée au destinataire, si nécessaire (principe P6). */
  note?: string;
};

/**
 * Formulation du cadeau révélé. Règle P6 : tant que le prestataire n'a rien
 * confirmé, on ne dit JAMAIS « transféré », « payé » ni « livré ».
 */
export function describeGift(gift: PublicGift): GiftDescription {
  switch (gift.type) {
    case "MONEY": {
      const d = gift.data;
      const confirmed = gift.status === "TRANSFERRED";
      return {
        kicker: "Je t'offre",
        title: formatAmount(d.amount, d.currency),
        lines: [RECEPTION[d.receptionMode]],
        message: d.message,
        note: confirmed ? "Transfert confirmé." : "Une promesse de l'expéditeur : ce montant n'a pas transité par ZAWELI.",
      };
    }
    case "PHYSICAL": {
      const d = gift.data;
      return {
        kicker: "Un cadeau t'attend",
        title: d.name,
        lines: [d.description, d.handover].filter((x): x is string => Boolean(x)),
        message: d.message,
        note: gift.status === "HANDED_OVER" ? "Remis, d'après l'expéditeur." : undefined,
      };
    }
    case "INVITATION": {
      const d = gift.data;
      return {
        kicker: "Je t'invite",
        title: d.title,
        lines: [
          `${formatDate(d.date)}${d.time ? ` à ${d.time.replace(":", " h ")}` : ""}`,
          d.place,
          d.address,
          d.practicalInfo,
        ].filter((x): x is string => Boolean(x)),
        message: d.message,
        note: gift.status === "CANCELLED" ? "Cette invitation a été annulée." : undefined,
      };
    }
    case "VOUCHER": {
      const d = gift.data;
      return {
        kicker: "Bon pour",
        title: d.title,
        lines: [
          d.value,
          d.issuer ? `Chez ${d.issuer}` : undefined,
          d.validUntil ? `Valable jusqu'au ${formatDate(d.validUntil)}` : undefined,
          d.conditions,
        ].filter((x): x is string => Boolean(x)),
        message: d.message,
      };
    }
    case "EXPERIENCE": {
      const d = gift.data;
      return {
        kicker: "Un moment à vivre",
        title: d.title,
        lines: [d.description, d.date, d.place].filter((x): x is string => Boolean(x)),
        message: d.message,
      };
    }
  }
}

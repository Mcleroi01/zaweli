/**
 * Registre des types de cadeaux (cahier des charges §9, architecture A9).
 *
 * Ajouter un type = enregistrer une définition ici (schéma des champs,
 * champs protégés, formulation) et les lignes SQL correspondantes
 * (gift_types, gift_type_statuses, gift_status_transitions).
 * Aucun template existant n'a besoin d'être modifié.
 */
import { z } from "zod";
import { currencySchema, DEFAULT_LOCALE, type GiftType, INTL_TAG, type Locale } from "@zaweli/shared-types";

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

type Wording = {
  reception: Record<GiftData<"MONEY">["receptionMode"], string>;
  money: { kicker: string; confirmed: string; promise: string };
  physical: { kicker: string; handedOver: string };
  invitation: { kicker: string; at: (time: string) => string; cancelled: string };
  voucher: { kicker: string; at: (issuer: string) => string; until: (date: string) => string };
  experience: { kicker: string };
};

/** Formulations de vérité (principe P6), dans chaque langue prise en charge. */
const WORDING: Record<Locale, Wording> = {
  fr: {
    reception: {
      in_person: "Remis en main propre",
      sender_mobile_money: "Envoyé par mobile money",
      other: "Modalité convenue ensemble",
    },
    money: {
      kicker: "Je t'offre",
      confirmed: "Transfert confirmé.",
      promise: "Une promesse de l'expéditeur : ce montant n'a pas transité par ZAWELI.",
    },
    physical: { kicker: "Un cadeau t'attend", handedOver: "Remis, d'après l'expéditeur." },
    invitation: { kicker: "Je t'invite", at: (t) => ` à ${t.replace(":", " h ")}`, cancelled: "Cette invitation a été annulée." },
    voucher: { kicker: "Bon pour", at: (i) => `Chez ${i}`, until: (d) => `Valable jusqu'au ${d}` },
    experience: { kicker: "Un moment à vivre" },
  },
  en: {
    reception: {
      in_person: "Handed over in person",
      sender_mobile_money: "Sent by mobile money",
      other: "Arranged together",
    },
    money: {
      kicker: "I'm giving you",
      confirmed: "Transfer confirmed.",
      promise: "A promise from the sender: this amount did not go through ZAWELI.",
    },
    physical: { kicker: "A gift is waiting for you", handedOver: "Handed over, according to the sender." },
    invitation: { kicker: "You're invited", at: (t) => ` at ${t}`, cancelled: "This invitation has been cancelled." },
    voucher: { kicker: "Voucher for", at: (i) => `At ${i}`, until: (d) => `Valid until ${d}` },
    experience: { kicker: "A moment to share" },
  },
};

const formatAmount = (amount: number, currency: string, locale: Locale) =>
  `${new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits: 2 }).format(amount)} ${currency}`;

const formatDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
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
 * Formulation du cadeau révélé, dans la langue de l'expérience. Règle P6 :
 * tant que le prestataire n'a rien confirmé, on ne dit JAMAIS « transféré »,
 * « payé » ni « livré ».
 */
export function describeGift(gift: PublicGift, locale: Locale = DEFAULT_LOCALE): GiftDescription {
  const w = WORDING[locale];
  switch (gift.type) {
    case "MONEY": {
      const d = gift.data;
      const confirmed = gift.status === "TRANSFERRED";
      return {
        kicker: w.money.kicker,
        title: formatAmount(d.amount, d.currency, locale),
        lines: [w.reception[d.receptionMode]],
        message: d.message,
        note: confirmed ? w.money.confirmed : w.money.promise,
      };
    }
    case "PHYSICAL": {
      const d = gift.data;
      return {
        kicker: w.physical.kicker,
        title: d.name,
        lines: [d.description, d.handover].filter((x): x is string => Boolean(x)),
        message: d.message,
        note: gift.status === "HANDED_OVER" ? w.physical.handedOver : undefined,
      };
    }
    case "INVITATION": {
      const d = gift.data;
      return {
        kicker: w.invitation.kicker,
        title: d.title,
        lines: [`${formatDate(d.date, locale)}${d.time ? w.invitation.at(d.time) : ""}`, d.place, d.address, d.practicalInfo].filter(
          (x): x is string => Boolean(x),
        ),
        message: d.message,
        note: gift.status === "CANCELLED" ? w.invitation.cancelled : undefined,
      };
    }
    case "VOUCHER": {
      const d = gift.data;
      return {
        kicker: w.voucher.kicker,
        title: d.title,
        lines: [
          d.value,
          d.issuer ? w.voucher.at(d.issuer) : undefined,
          d.validUntil ? w.voucher.until(formatDate(d.validUntil, locale)) : undefined,
          d.conditions,
        ].filter((x): x is string => Boolean(x)),
        message: d.message,
      };
    }
    case "EXPERIENCE": {
      const d = gift.data;
      return {
        kicker: w.experience.kicker,
        title: d.title,
        lines: [d.description, d.date, d.place].filter((x): x is string => Boolean(x)),
        message: d.message,
      };
    }
  }
}

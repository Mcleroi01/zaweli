import { z } from "zod";
import { currencySchema } from "./gifts.js";
import type { Locale } from "./i18n.js";

/**
 * Paiements par mobile money (MbiyoPay, docs/12).
 *
 * Pays, devises, réseaux et plafonds repris de la documentation MbiyoPay
 * (pages « Collect (Payin) » et « Send (Payout) », lues le 20 novembre 2026).
 * Les plafonds sont ceux du réseau : MbiyoPay refuse au-delà, on prévient avant.
 */
export type MobileMoneyCountry = {
  code: string;
  currencies: { code: string; min: number | null; max: number | null }[];
  networks: string[];
  /** Préfixe téléphonique international, sans « + ». */
  dialCode: string;
};

const c = (code: string, dialCode: string, networks: string[], currencies: MobileMoneyCountry["currencies"]): MobileMoneyCountry => ({
  code,
  dialCode,
  networks,
  currencies,
});
const xof = (min = 500) => [{ code: "XOF", min, max: 1_500_000 }];

export const MOBILE_MONEY_COUNTRIES: readonly MobileMoneyCountry[] = [
  c("CD", "243", ["vodacom", "airtel", "orange", "africell"], [
    { code: "USD", min: 0.1, max: 2_500 },
    { code: "CDF", min: 40, max: 5_000_000 },
  ]),
  c("CG", "242", ["mtn"], [{ code: "XAF", min: 500, max: 1_500_000 }]),
  c("CM", "237", ["orange", "mtn"], [{ code: "XAF", min: 50, max: 1_500_000 }]),
  c("BF", "226", ["orange", "moov", "coris"], xof()),
  c("BJ", "229", ["mtn", "moov", "celtiis"], xof(50)),
  c("CI", "225", ["orange", "mtn", "wave", "moov"], xof()),
  c("ML", "223", ["orange", "moov"], xof()),
  c("SN", "221", ["orange", "free", "wave"], xof()),
  c("TG", "228", ["moov", "togocom"], xof()),
  c("GN", "224", ["orange", "mtn"], [{ code: "GNF", min: 500, max: 1_500_000 }]),
  c("GM", "220", ["afrimoney", "qmoney", "wave", "aps"], [{ code: "GMD", min: 10, max: 200_000 }]),
  c("KE", "254", ["safaricom", "airtel"], [{ code: "KES", min: 10, max: 70_000 }]),
  c("UG", "256", ["mtn", "airtel"], [{ code: "UGX", min: 500, max: 5_000_000 }]),
  c("TZ", "255", ["vodacom", "airtel", "tigo", "halotel"], [{ code: "TZS", min: 500, max: 5_000_000 }]),
  c("RW", "250", ["mtn", "airtel"], [{ code: "RWF", min: 100, max: 5_000_000 }]),
  c("GH", "233", ["mtn", "vodafone", "airtel", "tigo"], [{ code: "GHS", min: null, max: null }]),
  c("NG", "234", ["mtn", "airtel", "glo", "9mobile"], [{ code: "NGN", min: null, max: null }]),
  c("ZM", "260", ["mtn", "airtel", "zamtel"], [
    { code: "ZMW", min: null, max: null },
    { code: "USD", min: null, max: null },
  ]),
];

export const mobileMoneyCountry = (code: string) => MOBILE_MONEY_COUNTRIES.find((x) => x.code === code);

/** Pays où une devise peut être payée ou reçue. */
export const countriesForCurrency = (currency: string) => MOBILE_MONEY_COUNTRIES.filter((x) => x.currencies.some((y) => y.code === currency));

/** Numéro au format international, chiffres seulement (MbiyoPay accepte « 243970000000 »). */
export function normalizePhone(countryCode: string, raw: string): string | null {
  const country = mobileMoneyCountry(countryCode);
  if (!country) return null;
  let digits = raw.replace(/[\s().-]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = country.dialCode + digits.slice(1);
  else if (!digits.startsWith(country.dialCode)) digits = country.dialCode + digits;
  if (!/^\d{9,15}$/.test(digits) || !digits.startsWith(country.dialCode)) return null;
  return digits;
}

/** Qui paie (ou qui reçoit) : pays, réseau, numéro. Le réseau doit exister dans le pays. */
export const mobileMoneyAccountSchema = z
  .strictObject({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    network: z.string().regex(/^[a-z0-9]{2,20}$/),
    phoneNumber: z.string().trim().min(6).max(24),
  })
  .superRefine((v, ctx) => {
    const country = mobileMoneyCountry(v.countryCode);
    if (!country) {
      ctx.addIssue({ code: "custom", path: ["countryCode"], message: "pays non pris en charge par le mobile money" });
      return;
    }
    if (!country.networks.includes(v.network)) ctx.addIssue({ code: "custom", path: ["network"], message: "réseau inconnu dans ce pays" });
    if (!normalizePhone(v.countryCode, v.phoneNumber)) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "numéro invalide pour ce pays" });
  });
export type MobileMoneyAccount = z.infer<typeof mobileMoneyAccountSchema>;

export const createOrderSchema = z.strictObject({
  planCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
  currency: currencySchema,
  /** Inutile quand la carte cadeau couvre tout le prix. */
  payer: mobileMoneyAccountSchema.optional(),
  useGiftCard: z.boolean().default(false),
});

export const orderQuoteSchema = z.object({
  planCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
  currency: currencySchema,
});
export type OrderQuoteQuery = z.infer<typeof orderQuoteSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
/** Ce que le navigateur envoie (useGiftCard facultatif). */
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const finalizePaymentSchema = z.strictObject({ otp: z.string().regex(/^\d{4,8}$/) });
export type FinalizePaymentRequest = z.infer<typeof finalizePaymentSchema>;

export const fundGiftSchema = z.strictObject({ payer: mobileMoneyAccountSchema });
export type FundGiftRequest = z.infer<typeof fundGiftSchema>;

export const claimGiftSchema = z.strictObject({
  beneficiary: z.string().trim().min(2).max(80),
  account: mobileMoneyAccountSchema,
});
export type ClaimGiftRequest = z.infer<typeof claimGiftSchema>;

/**
 * Ce que la personne doit faire maintenant :
 *  - wait : valider sur son téléphone (USSD) puis attendre la confirmation ;
 *  - redirect : finir sur la page du réseau (Wave) ;
 *  - instructions : suivre les consignes du réseau (texte) ;
 *  - pin : saisir le code reçu (QMoney, APS en Gambie).
 */
export type PaymentNext = { kind: "wait" } | { kind: "redirect"; url: string } | { kind: "instructions"; text: string } | { kind: "pin" };

export type PaymentMode = "sandbox" | "live" | "disabled";

export type PaymentOptionsResponse = {
  mode: PaymentMode;
  countries: MobileMoneyCountry[];
  moneyTransfers: { enabled: boolean; feeRate: string | null };
};

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "expired" | "refunded" | "disputed";

export type OrderResponse = {
  id: string;
  status: OrderStatus;
  plan: { code: string; name: string };
  /** Payé par mobile money (0 si la carte cadeau a tout couvert). */
  amount: string;
  listAmount: string | null;
  discountAmount: string;
  creditAmount: string;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  licenseId: string | null;
  /** Étape en cours, tant que la commande attend le paiement. */
  next: PaymentNext | null;
  /** Message du réseau quand le paiement a échoué (en anglais, tel que fourni). */
  failureReason: string | null;
};

export type TransferStatus = "initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "refunded";

export type GiftFundingResponse = {
  giftId: string;
  giftStatus: string;
  amount: string;
  fee: string;
  total: string;
  currency: string;
  transfer: { id: string; status: TransferStatus; next: PaymentNext | null; failureReason: string | null } | null;
};

export type GiftClaimResponse = {
  /** Langue de l'expérience : la page de réception parle comme elle. */
  locale: Locale;
  amount: string;
  currency: string;
  /** claimable : à recevoir ; pending : envoi en cours ; transferred : reçu ; unavailable : rien à recevoir ici. */
  state: "claimable" | "pending" | "transferred" | "unavailable";
  countries: MobileMoneyCountry[];
  /** Après un échec d'envoi, le destinataire peut réessayer avec un autre numéro. */
  lastAttemptFailed: boolean;
};

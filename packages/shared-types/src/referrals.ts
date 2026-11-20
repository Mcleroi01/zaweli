import { z } from "zod";
import { currencySchema } from "./gifts.js";

/**
 * Parrainage et cartes cadeaux (docs/13).
 *
 * Un filleul compte quand il paie sa PREMIÈRE formule. Aux paliers réglés
 * par l'administration (ex. 25 et 50 filleuls), le parrain reçoit une carte
 * cadeau, utilisable pour payer une formule.
 */

/** Code de parrainage : 8 caractères, sans 0/O ni 1/I (lisibles à voix haute). */
export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/);

export const attachReferralSchema = z.strictObject({ code: referralCodeSchema });
export type AttachReferralRequest = z.infer<typeof attachReferralSchema>;

/** Paramètre d'URL qui porte le code : https://zaweli.store/?parrain=ABCD2345 */
export const REFERRAL_PARAM = "parrain";

export const rewardTierSchema = z.strictObject({
  threshold: z.number().int().min(1).max(100_000),
  amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
  currency: currencySchema,
});
export type RewardTier = z.infer<typeof rewardTierSchema>;

export type GiftCardResponse = {
  id: string;
  amount: string;
  balance: string;
  currency: string;
  source: "referral" | "admin";
  createdAt: string;
  expiresAt: string | null;
};

export type ReferralSummaryResponse = {
  code: string;
  /** Filleuls ayant payé leur première formule. */
  qualified: number;
  /** Inscrits par le lien, sans achat pour l'instant. */
  pending: number;
  tiers: Array<RewardTier & { reached: boolean }>;
  giftCards: GiftCardResponse[];
  /** Réduction offerte au filleul sur sa première formule (ex. "0.20"), ou null. */
  refereeDiscountRate: string | null;
};

/** Devis d'une formule avant paiement : prix, réduction de filleul, carte cadeau. */
export type OrderQuoteResponse = {
  planCode: string;
  currency: string;
  listAmount: string;
  discountAmount: string;
  discountRate: string | null;
  /** Solde de cartes cadeaux utilisable dans cette devise. */
  giftCardBalance: string;
  /** Part couverte par la carte si elle est utilisée. */
  creditAmount: string;
  totalWithoutCredit: string;
  totalWithCredit: string;
};

// ---------------------------------------------------------------------
// Administration : paiements et parrainage
// ---------------------------------------------------------------------

const rate = z.string().regex(/^(0(\.\d{1,6})?|1(\.0{1,6})?)$/);

export const adminPaymentSettingsSchema = z.strictObject({
  moneyFeeRate: rate.nullable().optional(),
  moneyTransfersEnabled: z.boolean().optional(),
  refereeDiscountRate: rate.nullable().optional(),
  rewardTiers: z
    .array(rewardTierSchema)
    .max(10)
    .refine((t) => new Set(t.map((x) => x.threshold)).size === t.length, "un palier par seuil")
    .optional(),
});
export type AdminPaymentSettingsRequest = z.infer<typeof adminPaymentSettingsSchema>;

export type AdminPaymentSettingsResponse = {
  mode: "sandbox" | "live" | "disabled";
  webhookUrl: string | null;
  moneyFeeRate: string | null;
  moneyTransfersEnabled: boolean;
  refereeDiscountRate: string | null;
  rewardTiers: RewardTier[];
};

export const adminPaymentsListSchema = z.object({
  status: z.string().regex(/^[a-z_]{2,20}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminPaymentsListQuery = z.infer<typeof adminPaymentsListSchema>;

export type AdminOrderRow = {
  id: string;
  createdAt: string;
  paidAt: string | null;
  status: string;
  plan: string;
  amount: string;
  listAmount: string | null;
  discountAmount: string;
  creditAmount: string;
  currency: string;
  countryCode: string | null;
  providerRef: string | null;
  providerStatus: string | null;
};

export type AdminTransferRow = {
  id: string;
  createdAt: string;
  confirmedAt: string | null;
  direction: "funding" | "payout";
  status: string;
  amount: string;
  fee: string;
  currency: string;
  countryCode: string;
  network: string;
  phoneLast4: string;
  giftStatus: string | null;
  providerRef: string | null;
  failureReason: string | null;
};

export type AdminReconcileResponse = { checked: number; settled: number };

export type AdminReferrerRow = { referrerId: string; displayName: string | null; code: string | null; qualified: number; pending: number; cardsGranted: number };

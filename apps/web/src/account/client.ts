"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ApiError,
  CreateExperienceRequest,
  CreateGiftRequest,
  AiSuggestInput,
  AiSuggestResponse,
  CreateMediaUploadRequest,
  CreateOrderInput,
  CreateRecipientRequest,
  EligibilityResponse,
  ExperienceDetailResponse,
  ExperienceSettingsRequest,
  MusicSearchResponse,
  ExperienceStatus,
  ExperienceSummaryResponse,
  GiftFundingResponse,
  GiftResponse,
  LicenseResponse,
  Locale,
  MediaResponse,
  MediaUploadResponse,
  MediaUrlsResponse,
  MobileMoneyAccount,
  OrderQuoteResponse,
  OrderResponse,
  PaymentOptionsResponse,
  PlanResponse,
  ReferralSummaryResponse,
  ProfileResponse,
  PublishExperienceRequest,
  PublishResponse,
  RecipientResponse,
  TemplateDetailResponse,
  TemplateSummaryResponse,
  UpdateExperienceRequest,
  UpdateGiftRequest,
  UpdateProfileRequest,
  UpdateRecipientRequest,
} from "@zaweli/shared-types";
import { SITE_URL } from "@/content/site";

/**
 * Configuration publique de l'espace client (intégrée au code livré : aucun secret).
 *  - NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : Supabase Auth ;
 *  - NEXT_PUBLIC_API_URL : l'API Zaweli, qui revérifie tout (propriété, licences, quotas).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * Origine des liens qui quittent le navigateur (e-mails de confirmation, liens partagés) :
 * NEXT_PUBLIC_SITE_URL si elle est fournie, sinon le domaine public en production.
 * Seul le développement garde l'adresse de la page (localhost).
 */
const PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? SITE_URL : "")).replace(/\/+$/, "");
export const publicOrigin = () => PUBLIC_ORIGIN || window.location.origin;

let supabase: SupabaseClient | null = null;

/** Client Supabase du navigateur : session conservée et renouvelée, retour Google en PKCE. */
export function getSupabase(): SupabaseClient {
  if (!authConfigured) throw new Error("not_configured");
  return (supabase ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  }));
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Client de l'API métier. Le jeton de la session Supabase accompagne chaque
 * appel ; la langue de la page choisit la langue des messages d'erreur.
 */
export function createAccountApi(locale: Locale) {
  async function call<T>(method: Method, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    if (!API_URL) throw new ApiRequestError(503, "SERVICE_UNAVAILABLE", "API");
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiRequestError(401, "UNAUTHENTICATED", "");
    let res: Response;
    try {
      res = await fetch(`${API_URL}/v1${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "accept-language": locale,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new ApiRequestError(503, "SERVICE_UNAVAILABLE", "");
    }
    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      const error = (await res.json().catch(() => null)) as ApiError | null;
      throw new ApiRequestError(res.status, error?.error.code ?? "INTERNAL_ERROR", error?.error.message ?? "", error?.error.details);
    }
    return (await res.json()) as T;
  }

  const lang = `lang=${locale}`;
  return {
    profile: () => call<ProfileResponse>("GET", "/me/profile"),
    updateProfile: (body: UpdateProfileRequest) => call<ProfileResponse>("PATCH", "/me/profile", body),

    templates: () => call<TemplateSummaryResponse[]>("GET", `/catalog/templates?${lang}`),
    template: (slug: string) => call<TemplateDetailResponse>("GET", `/catalog/templates/${slug}?${lang}`),

    recipients: () => call<RecipientResponse[]>("GET", "/recipients"),
    createRecipient: (body: CreateRecipientRequest) => call<RecipientResponse>("POST", "/recipients", body),
    updateRecipient: (id: string, body: UpdateRecipientRequest) => call<RecipientResponse>("PATCH", `/recipients/${id}`, body),
    removeRecipient: (id: string) => call<void>("DELETE", `/recipients/${id}`),

    experiences: (status?: ExperienceStatus) =>
      call<ExperienceSummaryResponse[]>("GET", `/experiences${status ? `?status=${status}` : ""}`),
    createExperience: (body: CreateExperienceRequest) => call<ExperienceDetailResponse>("POST", "/experiences", body),
    experience: (id: string) => call<ExperienceDetailResponse>("GET", `/experiences/${id}`),
    updateExperience: (id: string, body: UpdateExperienceRequest) => call<ExperienceDetailResponse>("PATCH", `/experiences/${id}`, body),
    removeExperience: (id: string) => call<void>("DELETE", `/experiences/${id}`),
    settings: (id: string, body: ExperienceSettingsRequest) => call<ExperienceDetailResponse>("PUT", `/experiences/${id}/settings`, body),
    duplicate: (id: string, recipientId: string) => call<ExperienceDetailResponse>("POST", `/experiences/${id}/duplicate`, { recipientId }),
    searchMusic: (q: string) => call<MusicSearchResponse>("GET", `/music/audius/search?q=${encodeURIComponent(q)}&limit=10`),
    exportData: () => call<Record<string, unknown>>("GET", "/me/export"),
    deleteAccount: (confirmEmail: string) => call<void>("DELETE", "/me", { confirmEmail }),
    preview: (id: string) => call<{ rendererKey: string; payload: import("@zaweli/template-engine/schema").PublicPayload }>("GET", `/experiences/${id}/preview`),
    eligibility: (id: string) => call<EligibilityResponse>("GET", `/experiences/${id}/eligibility`),
    publish: (id: string, body: PublishExperienceRequest) => call<PublishResponse>("POST", `/experiences/${id}/publish`, body),
    setEnabled: (id: string, enabled: boolean) =>
      call<ExperienceDetailResponse>("POST", `/experiences/${id}/${enabled ? "enable" : "disable"}`),

    addGift: (id: string, body: CreateGiftRequest) => call<GiftResponse>("POST", `/experiences/${id}/gifts`, body),
    updateGift: (id: string, giftId: string, body: UpdateGiftRequest) => call<GiftResponse>("PATCH", `/experiences/${id}/gifts/${giftId}`, body),
    removeGift: (id: string, giftId: string) => call<void>("DELETE", `/experiences/${id}/gifts/${giftId}`),
    giftStatus: (id: string, giftId: string, status: string) =>
      call<GiftResponse>("POST", `/experiences/${id}/gifts/${giftId}/status`, { status }),

    licenses: () => call<LicenseResponse[]>("GET", "/licenses"),

    // Aide à l'écriture (docs/15)
    aiSuggest: (body: AiSuggestInput) => call<AiSuggestResponse>("POST", "/ai/suggest", body),

    // Photos (docs/14)
    createMediaUpload: (body: CreateMediaUploadRequest) => call<MediaUploadResponse>("POST", "/media/uploads", body),
    completeMedia: (mediaId: string) => call<MediaResponse>("POST", `/media/${mediaId}/complete`, {}),
    mediaUrls: (ids: string[]) => call<MediaUrlsResponse>("POST", "/media/urls", { ids }),

    // Paiements mobile money (docs/12)
    plans: () => call<PlanResponse[]>("GET", `/plans?${lang}`),
    paymentOptions: () => call<PaymentOptionsResponse>("GET", "/payments/options"),
    orders: () => call<OrderResponse[]>("GET", "/orders"),
    order: (orderId: string) => call<OrderResponse>("GET", `/orders/${orderId}`),
    /** La clé d'idempotence évite une double commande si le bouton est pressé deux fois. */
    quote: (planCode: string, currency: string) => call<OrderQuoteResponse>("GET", `/orders/quote?planCode=${planCode}&currency=${currency}`),
    createOrder: (body: CreateOrderInput, idempotencyKey: string) => call<OrderResponse>("POST", "/orders", body, { "idempotency-key": idempotencyKey }),
    finalizeOrder: (orderId: string, otp: string) => call<OrderResponse>("POST", `/orders/${orderId}/finalize`, { otp }),
    referral: () => call<ReferralSummaryResponse>("GET", "/referrals/me"),
    attachReferral: (code: string) => call<void>("POST", "/me/referral", { code }),
    giftFunding: (id: string, giftId: string) => call<GiftFundingResponse>("GET", `/experiences/${id}/gifts/${giftId}/funding`),
    fundGift: (id: string, giftId: string, payer: MobileMoneyAccount) => call<GiftFundingResponse>("POST", `/experiences/${id}/gifts/${giftId}/funding`, { payer }),
    finalizeGiftFunding: (id: string, giftId: string, otp: string) =>
      call<GiftFundingResponse>("POST", `/experiences/${id}/gifts/${giftId}/funding/finalize`, { otp }),
  };
}

export type AccountApi = ReturnType<typeof createAccountApi>;

/** Codes d'erreur Supabase Auth affichés tels quels (les autres deviennent « generic »). */
const AUTH_CODES = [
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "weak_password",
  "otp_expired",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "provider_disabled",
  "not_configured",
] as const;
export type AuthErrorCode = (typeof AUTH_CODES)[number] | "generic";

export function authErrorCode(error: unknown): AuthErrorCode {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? e?.message ?? "";
  if ((AUTH_CODES as readonly string[]).includes(code)) return code as AuthErrorCode;
  if (code === "email_exists" || code === "user_already_registered") return "user_already_exists";
  if (code === "validation_failed" && /provider/i.test(e?.message ?? "")) return "provider_disabled";
  if (/unsupported provider|provider is not enabled/i.test(e?.message ?? "")) return "provider_disabled";
  if (/token has expired|invalid/i.test(e?.message ?? "") && code.startsWith("otp")) return "otp_expired";
  return "generic";
}

/** Destination après connexion : uniquement un chemin interne (jamais une autre origine). */
export function safeNext(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

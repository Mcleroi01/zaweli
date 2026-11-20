import type {
  AdminAuditFacetsResponse,
  AdminAuditQuery,
  AdminAuditResponse,
  AdminCalendarResponse,
  AdminExchangeRateRequest,
  AdminExchangeRatesResponse,
  AdminGeoResponse,
  AdminOrderRow,
  AdminOverviewResponse,
  AdminPaymentSettingsRequest,
  AdminPlanRequest,
  AdminPlanRow,
  AdminReportRow,
  AdminSuspendedExperienceRow,
  AdminTemplateRow,
  AdminUserDetail,
  AdminUserRow,
  AdminPaymentSettingsResponse,
  AdminReconcileResponse,
  AdminReferrerRow,
  AdminTransferRow,
  AdminSubscriptionsResponse,
  AdminTimeseriesResponse,
  ApiError,
  InsightsRange,
  InsightsTimeseriesQuery,
  MeResponse,
} from "@zaweli/shared-types";
import { API_URL } from "./config";

/** Tout ce que l'administration lit ou écrit. Deux implémentations : l'API réelle, et la démonstration (développement). */
export interface AdminApi {
  me(): Promise<MeResponse>;
  overview(range: InsightsRange): Promise<AdminOverviewResponse>;
  timeseries(query: InsightsTimeseriesQuery): Promise<AdminTimeseriesResponse>;
  geo(range: InsightsRange): Promise<AdminGeoResponse>;
  subscriptions(): Promise<AdminSubscriptionsResponse>;
  calendar(month: string, tz: string): Promise<AdminCalendarResponse>;
  audit(query: Partial<AdminAuditQuery>): Promise<AdminAuditResponse>;
  auditFacets(): Promise<AdminAuditFacetsResponse>;
  exchangeRates(): Promise<AdminExchangeRatesResponse>;
  addExchangeRate(body: AdminExchangeRateRequest): Promise<AdminExchangeRatesResponse>;
  setReferenceCurrency(currency: string): Promise<AdminExchangeRatesResponse>;
  paymentSettings(): Promise<AdminPaymentSettingsResponse>;
  updatePaymentSettings(body: AdminPaymentSettingsRequest): Promise<AdminPaymentSettingsResponse>;
  paymentOrders(status?: string): Promise<AdminOrderRow[]>;
  paymentTransfers(status?: string): Promise<AdminTransferRow[]>;
  reconcilePayments(): Promise<AdminReconcileResponse>;
  referrers(): Promise<AdminReferrerRow[]>;
  // Gestion (docs/16)
  users(q: string, status: "all" | "suspended"): Promise<AdminUserRow[]>;
  user(id: string): Promise<AdminUserDetail>;
  suspendUser(id: string, reason: string): Promise<AdminUserDetail>;
  unsuspendUser(id: string): Promise<AdminUserDetail>;
  grantLicense(userId: string, planCode: string, reason: string): Promise<unknown>;
  revokeLicense(id: string, reason: string): Promise<unknown>;
  plans(): Promise<AdminPlanRow[]>;
  createPlan(body: Partial<AdminPlanRequest> & { code: string; name: string }): Promise<unknown>;
  updatePlan(code: string, body: Partial<Omit<AdminPlanRequest, "code">>): Promise<unknown>;
  setPrice(code: string, currency: string, amount: string): Promise<unknown>;
  templates(): Promise<AdminTemplateRow[]>;
  updateTemplate(slug: string, body: { status?: AdminTemplateRow["status"]; accessTags?: string[]; position?: number }): Promise<unknown>;
  reports(status: "open" | "dismissed" | "actioned"): Promise<AdminReportRow[]>;
  resolveReport(id: string, action: "dismiss" | "suspend", resolution: string): Promise<unknown>;
  suspendedExperiences(): Promise<AdminSuspendedExperienceRow[]>;
  suspendExperience(id: string, reason: string): Promise<unknown>;
  unsuspendExperience(id: string): Promise<unknown>;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined>;

/** Client de l'API réelle : jeton Supabase de la session, messages d'erreur en français. */
export function createHttpApi(getToken: () => Promise<string | null>): AdminApi {
  async function call<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, query?: Query, body?: unknown): Promise<T> {
    const token = await getToken();
    if (!token) throw new ApiRequestError(401, "UNAUTHENTICATED", "Session expirée : reconnectez-vous.");
    const url = new URL(`${API_URL}/v1${path}`);
    for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "accept-language": "fr",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      const error = (await res.json().catch(() => null)) as ApiError | null;
      throw new ApiRequestError(res.status, error?.error.code ?? "INTERNAL_ERROR", error?.error.message ?? `Erreur ${res.status}`);
    }
    return (await res.json()) as T;
  }

  return {
    me: () => call("GET", "/me"),
    overview: (r) => call("GET", "/admin/insights/overview", r),
    timeseries: (q) => call("GET", "/admin/insights/timeseries", q),
    geo: (r) => call("GET", "/admin/insights/geo", r),
    subscriptions: () => call("GET", "/admin/insights/subscriptions"),
    calendar: (month, tz) => call("GET", "/admin/insights/calendar", { month, tz }),
    audit: (q) => call("GET", "/admin/audit", q as Query),
    auditFacets: () => call("GET", "/admin/audit/facets"),
    exchangeRates: () => call("GET", "/admin/exchange-rates"),
    addExchangeRate: (body) => call("POST", "/admin/exchange-rates", undefined, body),
    setReferenceCurrency: (currency) => call("PUT", "/admin/exchange-rates/reference", undefined, { currency }),
    paymentSettings: () => call("GET", "/admin/payments/settings"),
    updatePaymentSettings: (body) => call("PUT", "/admin/payments/settings", undefined, body),
    paymentOrders: (status) => call("GET", "/admin/payments/orders", { status }),
    paymentTransfers: (status) => call("GET", "/admin/payments/transfers", { status }),
    reconcilePayments: () => call("POST", "/admin/payments/reconcile", undefined, {}),
    referrers: () => call("GET", "/admin/payments/referrers"),
    users: (q, status) => call("GET", "/admin/users", { q, status }),
    user: (id) => call("GET", `/admin/users/${id}`),
    suspendUser: (id, reason) => call("POST", `/admin/users/${id}/suspend`, undefined, { reason }),
    unsuspendUser: (id) => call("POST", `/admin/users/${id}/unsuspend`, undefined, {}),
    grantLicense: (userId, planCode, reason) => call("POST", "/admin/licenses", undefined, { userId, planCode, reason }),
    revokeLicense: (id, reason) => call("POST", `/admin/licenses/${id}/revoke`, undefined, { reason }),
    plans: () => call("GET", "/admin/plans"),
    createPlan: (body) => call("POST", "/admin/plans", undefined, body),
    updatePlan: (code, body) => call("PATCH", `/admin/plans/${code}`, undefined, body),
    setPrice: (code, currency, amount) => call("POST", `/admin/plans/${code}/prices`, undefined, { currency, amount }),
    templates: () => call("GET", "/admin/templates"),
    updateTemplate: (slug, body) => call("PATCH", `/admin/templates/${slug}`, undefined, body),
    reports: (status) => call("GET", "/admin/reports", { status }),
    resolveReport: (id, action, resolution) => call("POST", `/admin/reports/${id}/resolve`, undefined, { action, ...(resolution ? { resolution } : {}) }),
    suspendedExperiences: () => call("GET", "/admin/experiences/suspended"),
    suspendExperience: (id, reason) => call("POST", `/admin/experiences/${id}/suspend`, undefined, { reason }),
    unsuspendExperience: (id) => call("POST", `/admin/experiences/${id}/unsuspend`, undefined, {}),
  };
}

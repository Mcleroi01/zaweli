import type {
  AdminAuditFacetsResponse,
  AdminAuditQuery,
  AdminAuditResponse,
  AdminCalendarResponse,
  AdminExchangeRateRequest,
  AdminExchangeRatesResponse,
  AdminGeoResponse,
  AdminOverviewResponse,
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
  async function call<T>(method: "GET" | "POST" | "PUT", path: string, query?: Query, body?: unknown): Promise<T> {
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
  };
}

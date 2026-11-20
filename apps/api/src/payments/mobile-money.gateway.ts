import { createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PaymentMode, PaymentNext } from "@zaweli/shared-types";
import { ENV, type Env } from "../config/env.js";

/**
 * Passerelle mobile money. Interface abstraite : les tests branchent une
 * fausse passerelle, la production branche MbiyoPay (docs/12).
 */
export type GatewayStatus = "pending" | "successful" | "failed" | "cancelled";

export type GatewayTransaction = {
  transactionId: string;
  /** Notre référence (commande ou transfert), renvoyée telle quelle par le prestataire. */
  orderId: string | null;
  status: GatewayStatus;
  amount: number;
  fee: number;
  chargedAmount: number;
  currency: string;
  type: "cashin" | "cashout" | null;
};

export type GatewayInitiation = GatewayTransaction & { next: PaymentNext };

export type GatewayRequest = {
  orderId: string;
  amount: number;
  currency: string;
  countryCode: string;
  network: string;
  /** Numéro international, chiffres seulement. */
  phoneNumber: string;
  callbackUrl: string | null;
};

/** Refus explicite du prestataire (opérateur, plafond, solde, validation). */
export class GatewayRejected extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

export abstract class MobileMoneyGateway {
  abstract readonly mode: PaymentMode;
  abstract payin(request: GatewayRequest): Promise<GatewayInitiation>;
  abstract payout(request: GatewayRequest & { beneficiary: string; callbackUrl: string }): Promise<GatewayTransaction>;
  /** Transaction par identifiant du prestataire OU par notre référence ; null si inconnue. */
  abstract transaction(id: string): Promise<GatewayTransaction | null>;
  abstract finalize(transactionId: string, otp: string): Promise<void>;
  /** Signature d'un webhook ; null quand aucun secret n'est configuré (rien à vérifier). */
  abstract verifySignature(rawBody: Buffer | undefined, parsedBody: unknown, signature: string | undefined): boolean | null;
}

type Envelope = { status?: string; message?: string; data?: unknown };
type RawTransaction = {
  transaction_id?: string;
  order_id?: string | null;
  status?: string;
  amount?: number | string;
  fee?: number | string;
  charged_amount?: number | string;
  currency?: string;
  type?: string;
  redirect_url?: string | null;
  instructions?: string | null;
  auth_mode?: string | null;
};

const STATUSES: readonly GatewayStatus[] = ["pending", "successful", "failed", "cancelled"];
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : 0);

/** Les consignes du réseau arrivent en HTML : on n'en garde que le texte (jamais injecté tel quel). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 1000);
}

function toTransaction(raw: RawTransaction): GatewayTransaction {
  const status = STATUSES.includes(raw.status as GatewayStatus) ? (raw.status as GatewayStatus) : "pending";
  return {
    transactionId: String(raw.transaction_id ?? ""),
    orderId: raw.order_id ?? null,
    status,
    amount: num(raw.amount),
    fee: num(raw.fee),
    chargedAmount: num(raw.charged_amount),
    currency: String(raw.currency ?? ""),
    type: raw.type === "cashin" || raw.type === "cashout" ? raw.type : null,
  };
}

function nextOf(raw: RawTransaction): PaymentNext {
  if (raw.redirect_url?.startsWith("https://")) return { kind: "redirect", url: raw.redirect_url };
  if (raw.auth_mode === "pin") return { kind: "pin" };
  const text = raw.instructions ? htmlToText(raw.instructions) : "";
  return text ? { kind: "instructions", text } : { kind: "wait" };
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** MbiyoPay, API marchand v1. La clé choisit l'environnement (Test = sandbox, Live = réel). */
@Injectable()
export class MbiyoPayGateway extends MobileMoneyGateway {
  private readonly logger = new Logger("MbiyoPay");
  readonly mode: PaymentMode;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    this.mode = env.MBIYOPAY_API_KEY ? env.MBIYOPAY_MODE : "disabled";
  }

  async payin(r: GatewayRequest): Promise<GatewayInitiation> {
    const raw = (await this.call("POST", "/merchant/payin", this.body(r))) as RawTransaction;
    return { ...toTransaction(raw), next: nextOf(raw) };
  }

  async payout(r: GatewayRequest & { beneficiary: string; callbackUrl: string }): Promise<GatewayTransaction> {
    const body = this.body(r);
    (body.metadata as Record<string, unknown>).beneficiary = r.beneficiary;
    return toTransaction((await this.call("POST", "/merchant/payout", body)) as RawTransaction);
  }

  async transaction(id: string): Promise<GatewayTransaction | null> {
    try {
      return toTransaction((await this.call("GET", `/merchant/transactions/${encodeURIComponent(id)}`)) as RawTransaction);
    } catch (e) {
      if (e instanceof GatewayRejected && e.httpStatus === 404) return null;
      throw e;
    }
  }

  async finalize(transactionId: string, otp: string): Promise<void> {
    await this.call("POST", `/merchant/transactions/${encodeURIComponent(transactionId)}/finalize`, { otp });
  }

  /**
   * HMAC-SHA256 (hexadécimal) du corps JSON avec le secret des webhooks.
   * On vérifie d'abord le corps brut reçu ; à défaut, sa forme JSON
   * resérialisée (exemple Node.js de la documentation MbiyoPay).
   */
  verifySignature(rawBody: Buffer | undefined, parsedBody: unknown, signature: string | undefined): boolean | null {
    const secret = this.env.MBIYOPAY_WEBHOOK_SECRET;
    if (!secret) return null;
    if (!signature) return false;
    const given = signature.trim().toLowerCase();
    const sign = (data: Buffer | string) => createHmac("sha256", secret).update(data).digest("hex");
    if (rawBody && safeEqual(sign(rawBody), given)) return true;
    return safeEqual(sign(JSON.stringify(parsedBody)), given);
  }

  private body(r: GatewayRequest): Record<string, unknown> {
    return {
      amount: r.amount,
      currency: r.currency,
      payment_method: "mobile_money",
      order_id: r.orderId,
      ...(r.callbackUrl ? { callback_url: r.callbackUrl } : {}),
      metadata: { network: r.network, phone_number: r.phoneNumber, country_code: r.countryCode },
    };
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const key = this.env.MBIYOPAY_API_KEY;
    if (!key) throw new GatewayRejected("not_configured", 503);
    const init: RequestInit = {
      method,
      headers: { authorization: `Bearer ${key}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
      signal: AbortSignal.timeout(20_000),
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(`${this.env.MBIYOPAY_BASE_URL.replace(/\/+$/, "")}${path}`, init);
    const envelope = (await res.json().catch(() => ({}))) as Envelope;
    // HTTP 200 avec « status: error » existe (refus de l'opérateur) : on lit toujours le statut du corps.
    if (!res.ok || envelope.status !== "success") {
      const message = (envelope.message ?? `HTTP ${res.status}`).slice(0, 300);
      if (res.status >= 500) this.logger.warn(`${method} ${path} → ${res.status} ${message}`);
      throw new GatewayRejected(message, res.ok ? 422 : res.status);
    }
    return envelope.data ?? {};
  }
}

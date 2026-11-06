import { Inject, Injectable } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ENV, type Env } from "../config/env.js";

export type AuthenticatedUser = { id: string; email: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vérifie les jetons d'accès Supabase Auth avec les clés PUBLIQUES (JWKS),
 * mises en cache et renouvelées automatiquement par `jose`.
 * Contrôles : signature, algorithme asymétrique, émetteur, audience,
 * expiration, et sujet au format UUID.
 */
@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(ENV) env: Env) {
    const base = env.SUPABASE_URL.replace(/\/+$/, "");
    this.issuer = `${base}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify<JWTPayload & { email?: string; role?: string }>(token, this.jwks, {
      issuer: this.issuer,
      audience: "authenticated",
      algorithms: ["ES256", "RS256", "EdDSA"],
    });
    if (!payload.sub || !UUID.test(payload.sub) || payload.role !== "authenticated") {
      throw new Error("jeton sans utilisateur authentifié");
    }
    return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
  }
}

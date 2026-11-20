import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://zaweli_api_login:x@127.0.0.1:54322/postgres",
  SUPABASE_URL: "http://127.0.0.1:54321",
};

describe("loadEnv", () => {
  it("applique les valeurs par défaut", () => {
    const env = loadEnv(base);
    expect(env).toMatchObject({ NODE_ENV: "development", PORT: 4000, CORS_ORIGINS: [] });
  });

  it("découpe les origines CORS", () => {
    expect(loadEnv({ ...base, CORS_ORIGINS: "http://a.test, http://b.test ," }).CORS_ORIGINS).toEqual([
      "http://a.test",
      "http://b.test",
    ]);
  });

  it("refuse une configuration incomplète avec un message lisible", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...base, SUPABASE_URL: "pas une url" })).toThrow(/SUPABASE_URL/);
  });

  it("refuse le super-utilisateur postgres en production", () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: "production",
        CORS_ORIGINS: "https://zaweli.app",
        DATABASE_URL: "postgresql://postgres:x@db/postgres",
      }),
    ).toThrow(/rôle dédié/);
  });

  it("exige les origines CORS en production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow(/CORS_ORIGINS/);
  });

  it("lit TRUST_PROXY : vide, nombre de mandataires, booléen ou liste", () => {
    expect(loadEnv(base).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...base, TRUST_PROXY: "2" }).TRUST_PROXY).toBe(2);
    expect(loadEnv({ ...base, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true);
    expect(loadEnv({ ...base, TRUST_PROXY: "loopback, 10.0.0.0/8" }).TRUST_PROXY).toBe("loopback, 10.0.0.0/8");
  });
});

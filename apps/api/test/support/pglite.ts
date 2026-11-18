/**
 * PostgreSQL embarqué (PGlite, PostgreSQL 16 en WebAssembly) pour tester
 * l'API SANS Docker : les vraies migrations, les vrais déclencheurs et les
 * vraies fonctions SQL, derrière le même client Kysely que la production.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "../../src/database/database.types.js";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

/** Le strict nécessaire de Supabase : rôles, auth.users, storage.buckets. */
const SUPABASE_SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
`;

export async function createTestDatabase() {
  const pg = new PGlite();
  await pg.exec(SUPABASE_SHIM);
  const dir = join(ROOT, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, file), "utf8"));
  }

  // Adaptateur minimal « pool pg » : une seule connexion, requêtes sérialisées par PGlite.
  const client = {
    async query(sql: string, parameters: unknown[]) {
      const result = await pg.query<Record<string, unknown>>(sql, parameters);
      const command = sql.trimStart().split(/\s+/, 1)[0]!.toUpperCase();
      return { command, rowCount: result.affectedRows ?? result.rows.length, rows: result.rows };
    },
    release() {},
  };
  const pool = { connect: async () => client, end: async () => {} };
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: pool as never }) });
  return { pg, db };
}

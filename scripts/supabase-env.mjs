#!/usr/bin/env node
/**
 * Génère les fichiers d'environnement LOCAUX à partir de `supabase status`.
 *   - apps/api/.env
 *   - apps/web/.env.local
 *
 * Usage : pnpm env:local   (Supabase local doit être démarré : pnpm db:start)
 *
 * Ces fichiers sont ignorés par Git. Les valeurs ne valent que pour la base
 * locale Docker : en staging et production, les variables sont saisies dans
 * l'hébergeur (voir docs/06-fondation-technique.md).
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

let status;
try {
  status = JSON.parse(execSync("pnpm exec supabase status -o json", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  console.error("Supabase local ne répond pas. Lance d'abord : pnpm db:start");
  process.exit(1);
}

const need = (key) => {
  if (!status[key]) {
    console.error(`Valeur manquante dans supabase status : ${key}`);
    process.exit(1);
  }
  return status[key];
};

const dbUrl = new URL(need("DB_URL"));
// L'API se connecte avec son rôle dédié (seed local), jamais en postgres.
const apiDbUrl = `postgresql://zaweli_api_login:zaweli_local_dev_only@${dbUrl.host}${dbUrl.pathname}`;

const api = {
  NODE_ENV: "development",
  PORT: "4000",
  APP_VERSION: "0.0.0-local",
  DATABASE_URL: apiDbUrl,
  SUPABASE_URL: need("API_URL"),
  CORS_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
  // Tests e2e uniquement : création d'utilisateurs de test via l'API admin d'Auth.
  E2E_SUPABASE_SECRET_KEY: need("SECRET_KEY"),
  E2E_DATABASE_ADMIN_URL: need("DB_URL"),
};

const web = {
  NEXT_PUBLIC_SUPABASE_URL: need("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: need("PUBLISHABLE_KEY"),
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
};

const write = (file, vars) => {
  const body = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n");
  writeFileSync(join(root, file), `# Généré par scripts/supabase-env.mjs — base locale uniquement\n${body}\n`);
  console.log(`✓ ${file}`);
};

write("apps/api/.env", api);
write("apps/web/.env.local", web);

#!/usr/bin/env node
/**
 * DÉVELOPPEMENT LOCAL UNIQUEMENT.
 * Publie une expérience Coffret de démonstration sur la base locale, en
 * passant par le VRAI chemin de données : utilisateur Supabase Auth,
 * destinataire, cadeaux typés (contraintes SQL), consommation d'un droit
 * de licence (app.consume_publication), instantané publié, lien public.
 *
 * Le contenu est celui de la démonstration (illustrations, aucune photo réelle).
 * Usage : pnpm demo:seed   (après pnpm db:start, pnpm env:local, pnpm templates:sync)
 */
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { coffretDemoPayload, coffretV1 } from "@zaweli/template-coffret";

process.loadEnvFile(new URL("../.env", import.meta.url));

const dbUrl = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(dbUrl.hostname)) {
  console.error("Refus : ce script ne s'exécute que sur la base locale.");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET = process.env.E2E_SUPABASE_SECRET_KEY;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const slug = Array.from(randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]).join("");

// 1. Utilisateur de démonstration (Supabase Auth local).
const email = `demo+${Date.now()}@zaweli.local`;
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
  body: JSON.stringify({ email, password: randomUUID(), email_confirm: true }),
});
if (!res.ok) throw new Error(`Création de l'utilisateur : ${res.status} ${await res.text()} (si 401 : relance `pnpm env:local`, la clé change à chaque redémarrage de Supabase)`);
const userId = (await res.json()).id;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query("set local app.actor = 'system'");

  const tpl = await client.query(
    `select t.id, t.current_version_id from app.templates t
      join app.template_versions v on v.id = t.current_version_id
     where t.slug = $1 and v.renderer_key = $2`,
    [coffretV1.slug, coffretV1.rendererKey],
  );
  if (!tpl.rowCount) throw new Error("Coffret absent de la base : lance d'abord `pnpm templates:sync`.");
  const { id: templateId, current_version_id: versionId } = tpl.rows[0];
  // En local, on rend le template visible au catalogue (décision commerciale en production).
  await client.query("update app.templates set status = 'published' where id = $1", [templateId]);

  // 2. Formule et licence LOCALES (aucune valeur commerciale réelle).
  const plan = await client.query(
    `insert into app.plans (code, name, template_access_mode, max_publications_per_day)
     values ('DEMO_LOCAL', 'Démonstration locale', 'all', 100)
     on conflict (code) do update set name = excluded.name returning *`,
  );
  const p = plan.rows[0];
  const license = await client.query(
    `insert into app.licenses (user_id, plan_id, source, status, starts_at, start_policy, publications_max, recipients_max,
       ai_generations_max, template_access_mode, edit_policy, max_publications_per_day)
     values ($1, $2, 'admin_grant', 'active', now(), 'immediate', null, null, 0, 'all', 'while_valid', $3)
     returning id`,
    [userId, p.id, p.max_publications_per_day],
  );

  // 3. Destinataire et expérience (brouillon).
  const demo = await coffretDemoPayload();
  const recipient = await client.query(
    "insert into app.recipients (owner_id, display_name) values ($1, $2) returning id",
    [userId, demo.fields.name],
  );
  const experience = await client.query(
    `insert into app.experiences (owner_id, template_id, template_version_id, recipient_id, title)
     values ($1, $2, $3, $4, 'Démonstration Coffret') returning id`,
    [userId, templateId, versionId, recipient.rows[0].id],
  );
  const experienceId = experience.rows[0].id;

  // 4. Cadeaux typés : passent par les contrôles SQL (statut initial, montant, C1…).
  const gifts = [];
  for (const [position, gift] of demo.fields.gifts.entries()) {
    const money = gift.type === "MONEY";
    const row = await client.query(
      `insert into app.gifts (owner_id, experience_id, position, gift_type, status, data, amount, currency)
       values ($1, $2, $3, $4, 'ANNOUNCED', $5, $6, $7) returning id, status`,
      [userId, experienceId, position, gift.type, JSON.stringify(gift.data), money ? gift.data.amount : null, money ? gift.data.currency : null],
    );
    gifts.push({ ...gift, id: row.rows[0].id, status: row.rows[0].status });
  }

  // 5. Publication : consommation d'un droit, puis instantané figé.
  await client.query("select app.consume_publication($1, $2, $3)", [userId, license.rows[0].id, experienceId]);
  const payload = { ...demo, fields: { ...demo.fields, gifts } };
  const snapshot = await client.query(
    `insert into app.experience_snapshots (experience_id, revision, template_version_id, public_payload, created_by)
     values ($1, 1, $2, $3, $4) returning id`,
    [experienceId, versionId, JSON.stringify(payload), userId],
  );
  await client.query(
    `update app.experiences
        set status = 'published', slug = $2, current_snapshot_id = $3,
            first_published_at = now(), last_published_at = now(), status_changed_at = now()
      where id = $1`,
    [experienceId, slug, snapshot.rows[0].id],
  );
  await client.query(
    `insert into app.audit_log (actor_type, actor_id, action, entity_type, entity_id, data)
     values ('system', $1, 'experience.published', 'experience', $2, $3)`,
    [userId, experienceId, JSON.stringify({ slug, demo: true })],
  );
  await client.query("commit");
  console.log(`✓ Expérience de démonstration publiée : http://localhost:3000/g/${slug}`);
} catch (error) {
  await client.query("rollback");
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}

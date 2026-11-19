// Vérifie les migrations ZAWELI sur PostgreSQL 16 embarqué (PGlite).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Usage (depuis la racine du dépôt) : node supabase/tests/migrations.pglite.mjs
// Dépendance de développement : @electric-sql/pglite (ajoutée au package.json en phase 5).
const ROOT = process.argv[2] ?? process.cwd();
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log("  ✓", name); };
const ko = (name, e) => { fail++; console.log("  ✗", name, "→", e); };

async function expectOk(name, sql, params) {
  try { const r = await db.query(sql, params); ok(name); return r; } catch (e) { ko(name, e.message); }
}
async function expectErr(name, sql, code, params) {
  try { await db.query(sql, params); ko(name, `aucune erreur (attendu ${code})`); }
  catch (e) { (e.message.includes(code) ? ok : (n) => ko(n, e.message))(name); }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

// --- Simulation minimale de Supabase ---------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
`);

// --- Migrations dans l'ordre -----------------------------------------
console.log("Migrations :");
const migDir = join(ROOT, "supabase", "migrations");
for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  try { await db.exec(readFileSync(join(migDir, f), "utf8")); ok(f); }
  catch (e) { ko(f, e.message); process.exitCode = 1; }
}
console.log("Seed :");
for (const f of readdirSync(join(ROOT, "supabase", "seed")).sort()) {
  const sql = readFileSync(join(ROOT, "supabase", "seed", f), "utf8");
  try { await db.exec(sql); await db.exec(sql); ok(`${f} (joué 2 fois : idempotent)`); }
  catch (e) { ko(f, e.message); }
}
if (fail) { console.log(`\n${fail} échec(s) : arrêt.`); process.exit(1); }

console.log("\nStructure :");
const noRls = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='app' and c.relkind='r' and not c.relrowsecurity`);
noRls.rows.length ? ko("every_app_table_has_rls", noRls.rows.map((r) => r.relname).join(",")) : ok("every_app_table_has_rls");
const tables = await one(`select count(*)::int n from pg_tables where schemaname='app'`);
console.log(`    (${tables.n} tables dans le schéma app)`);
const buckets = await one(`select string_agg(id || (case when public then ':public' else ':private' end), ', ' order by id) b from storage.buckets`);
console.log(`    buckets : ${buckets.b}`);

// --- Données de test -------------------------------------------------
const u1 = (await one(`insert into auth.users(email,email_confirmed_at) values('a@x.test',now()) returning id`)).id;
const u2 = (await one(`insert into auth.users(email,email_confirmed_at) values('b@x.test',now()) returning id`)).id;
console.log("\nIdentité :");
(await one(`select count(*)::int n from app.profiles where id in ($1,$2)`, [u1, u2])).n === 2
  ? ok("profil créé automatiquement à l'inscription") : ko("profil auto", "absent");

console.log("\nCatalogue :");
const cat = (await one(`select id from app.template_categories where slug='anniversaire'`)).id;
const tpl = (await one(`insert into app.templates(slug,name,category_id,status) values('coffret','Coffret',$1,'published') returning id`, [cat])).id;
const hash = "a".repeat(64);
const tv = (await one(`insert into app.template_versions(template_id,version,renderer_key,manifest,manifest_hash,status,published_at)
  values($1,'1.0.0','coffret@1.0.0','{"slug":"coffret"}',$2,'published',now()) returning id`, [tpl, hash])).id;
await expectOk("version courante (FK composite)", `update app.templates set current_version_id=$1 where id=$2`, [tv, tpl]);
await db.query(`insert into app.template_access_tags values ($1,'free-eligible'),($1,'multi')`, [tpl]);
await expectErr("version publiée immuable (manifeste)", `update app.template_versions set manifest='{"x":1}' where id=$1`, "TEMPLATE_VERSION_IMMUTABLE", [tv]);
await expectOk("version publiée : statut d'affichage modifiable", `update app.template_versions set status='hidden' where id=$1`, [tv]);
await db.query(`update app.template_versions set status='published' where id=$1`, [tv]);

// Formules de TEST (valeurs arbitraires propres au test, pas des décisions)
const free = (await one(`insert into app.plans(code,name,is_free,is_active,duration_days,start_policy,publications_max,ai_generations_max,template_access_mode,template_access_tag)
  values('FREE','Gratuit',true,true,null,'immediate',1,2,'tagged','free-eligible') returning id`)).id;
const multi = (await one(`insert into app.plans(code,name,is_active,duration_days,publications_max,recipients_max,ai_generations_max,template_access_mode,max_publications_per_day)
  values('MULTI_USE','Multi',true,30,null,3,10,'all',50) returning id`)).id;
const solo = (await one(`insert into app.plans(code,name,is_active,duration_days,publications_max,template_access_mode,template_access_tag)
  values('SOLO','Solo',true,7,1,'tagged','solo') returning id`)).id;
await expectErr("une seule formule gratuite", `insert into app.plans(code,name,is_free,template_access_mode) values('FREE2','x',true,'all')`, "plans_single_free_idx");

const rec = async (owner, name) => (await one(`insert into app.recipients(owner_id,display_name) values($1,$2) returning id`, [owner, name])).id;
const exp = async (owner, recipient) => (await one(`insert into app.experiences(owner_id,template_id,template_version_id,recipient_id) values($1,$2,$3,$4) returning id`, [owner, tpl, tv, recipient])).id;

console.log("\nExpériences :");
const r1 = await rec(u1, "Pauline");
const rOther = await rec(u2, "Autre");
await expectErr("destinataire d'un autre propriétaire refusé", `insert into app.experiences(owner_id,template_id,template_version_id,recipient_id) values($1,$2,$3,$4)`, "foreign key", [u1, tpl, tv, rOther]);
await expectErr("statut publié sans lien refusé", `insert into app.experiences(owner_id,template_id,template_version_id,recipient_id,status) values($1,$2,$3,$4,'published')`, "check constraint", [u1, tpl, tv, r1]);

console.log("\nLicences — FREE (S1, S2) :");
const lf = (await one(`select app.ensure_free_license($1) id`, [u1])).id;
(await one(`select app.ensure_free_license($1) id`, [u1])).id === lf ? ok("ensure_free_license idempotent") : ko("idempotence FREE", "2 licences");
const e1 = await exp(u1, r1);
await expectOk("S1 : 1re publication gratuite", `select app.consume_publication($1,$2,$3)`, [u1, lf, e1]);
await expectErr("double consommation de la même expérience", `select app.consume_publication($1,$2,$3)`, "EXPERIENCE_ALREADY_CONSUMED", [u1, lf, e1]);
const e2 = await exp(u1, r1);
await expectErr("S2 : 2e publication gratuite refusée", `select app.consume_publication($1,$2,$3)`, "LICENSE_PUBLICATION_LIMIT_REACHED", [u1, lf, e2]);
await expectErr("licence d'un autre utilisateur", `select app.consume_publication($1,$2,$3)`, "LICENSE_NOT_FOUND", [u2, lf, e2]);
await expectErr("2e licence FREE insérée à la main", `insert into app.licenses(user_id,plan_id,source,start_policy,template_access_mode,edit_policy,max_publications_per_day) values($1,$2,'free','immediate','all','never',1)`, "licenses_one_free_per_user_idx", [u1, free]);

console.log("\nPaiement → licence (S4, S5) :");
const price = (await one(`insert into app.plan_prices(plan_id,currency,amount) values($1,'USD',9.99) returning id`, [multi])).id;
const order = (await one(`insert into app.orders(user_id,plan_id,plan_price_id,amount,currency,idempotency_key,provider) values($1,$2,$3,9.99,'USD','key-0001-abc','mbiyopay') returning id`, [u1, multi, price])).id;
await expectErr("S4 : licence non activable si commande non payée", `select app.activate_purchase_license($1)`, "LICENSE_ORDER_NOT_PAID", [order]);
await expectErr("commande « paid » refusée hors prestataire", `update app.orders set status='paid', paid_at=now() where id=$1`, "ORDERS_REQUIRES_PROVIDER", [order]);
await expectErr("même clé d'idempotence refusée", `insert into app.orders(user_id,plan_id,plan_price_id,amount,currency,idempotency_key,provider) values($1,$2,$3,9.99,'USD','key-0001-abc','mbiyopay')`, "unique", [u1, multi, price]);
await db.exec(`begin; set local app.actor = 'provider';`);
await expectOk("commande payée par le prestataire", `update app.orders set status='paid', paid_at=now() where id=$1`, [order]);
const lm = (await one(`select app.activate_purchase_license($1) id`, [order])).id;
(await one(`select app.activate_purchase_license($1) id`, [order])).id === lm ? ok("S5 : activation idempotente (même licence)") : ko("S5", "2 licences");
await db.exec(`commit;`);
const lmRow = await one(`select status, ends_at > now() + interval '29 days' ok from app.licenses where id=$1`, [lm]);
lmRow.status === "active" && lmRow.ok ? ok("licence active, fin = paiement + 30 j (règle copiée)") : ko("licence", JSON.stringify(lmRow));
await expectOk("modifier la formule ne change pas la licence vendue", `update app.plans set recipients_max=10 where id=$1`, [multi]);
(await one(`select recipients_max from app.licenses where id=$1`, [lm])).recipients_max === 3 ? ok("  → la licence garde recipients_max = 3") : ko("copie", "modifiée");

console.log("\nMULTI-USE (S7, S8) :");
const rs = [r1, await rec(u1, "B"), await rec(u1, "C"), await rec(u1, "D")];
for (let i = 0; i < 3; i++) await expectOk(`publication pour le destinataire ${i + 1}`, `select app.consume_publication($1,$2,$3)`, [u1, lm, await exp(u1, rs[i])]);
await expectErr("S7 : 4e destinataire refusé", `select app.consume_publication($1,$2,$3)`, "LICENSE_RECIPIENT_LIMIT_REACHED", [u1, lm, await exp(u1, rs[3])]);
await expectOk("S8 : nouvelle expérience pour un destinataire déjà lié", `select app.consume_publication($1,$2,$3)`, [u1, lm, await exp(u1, rs[0])]);

console.log("\nAccès au template et expiration (S9) :");
const soloLic = (await one(`insert into app.licenses(user_id,plan_id,source,status,starts_at,ends_at,start_policy,publications_max,template_access_mode,template_access_tag,edit_policy,max_publications_per_day)
  values($1,$2,'admin_grant','active',now()-interval '8 days',now()-interval '1 day','on_payment_confirmed',1,'tagged','solo','while_valid',5) returning id`, [u1, solo])).id;
const e3 = await exp(u1, r1);
await expectErr("S9 : licence expirée", `select app.consume_publication($1,$2,$3)`, "LICENSE_EXPIRED", [u1, soloLic, e3]);
await db.query(`update app.licenses set ends_at=now()+interval '1 day' where id=$1`, [soloLic]);
await expectErr("template non inclus dans la formule", `select app.consume_publication($1,$2,$3)`, "LICENSE_TEMPLATE_NOT_ALLOWED", [u1, soloLic, e3]);
const expired = await one(`update app.licenses set ends_at=now()-interval '1 minute' where id=$1 returning id`, [soloLic]);
(await one(`select app.expire_licenses() n`)).n >= 1 ? ok("expire_licenses() passe les licences échues en expired") : ko("expire", "0");

console.log("\nInstantanés et versions :");
await db.exec(`begin;`);
const snap = (await one(`insert into app.experience_snapshots(experience_id,revision,template_version_id,public_payload) values($1,1,$2,'{}') returning id`, [e1, tv])).id;
await expectOk("publier : lien + instantané courant", `update app.experiences set status='published', slug='Abc123XyZ9', first_published_at=now(), last_published_at=now(), current_snapshot_id=$2 where id=$1`, [e1, snap]);
await db.exec(`commit;`);
await expectErr("instantané immuable", `update app.experience_snapshots set public_payload='{"x":1}' where id=$1`, "SNAPSHOT_IS_IMMUTABLE", [snap]);
const tv2 = (await one(`insert into app.template_versions(template_id,version,renderer_key,manifest,manifest_hash) values($1,'1.1.0','coffret@1.1.0','{}',$2) returning id`, [tpl, hash])).id;
await expectErr("version figée après publication (S16)", `update app.experiences set template_version_id=$2 where id=$1`, "foreign key", [e1, tv2]);
await expectErr("lien au mauvais format", `update app.experiences set slug='pauline' where id=$1`, "check constraint", [e1]);

console.log("\nCadeaux (S11) :");
await expectOk("MONEY annoncé (promesse)", `insert into app.gifts(owner_id,experience_id,position,gift_type,status,amount,currency) values($1,$2,0,'MONEY','ANNOUNCED',50,'USD')`, [u1, e2]);
await expectErr("MONEY sans montant", `insert into app.gifts(owner_id,experience_id,position,gift_type,status) values($1,$2,1,'MONEY','ANNOUNCED')`, "GIFT_MONEY_REQUIRES_AMOUNT", [u1, e2]);
await expectErr("C1 : transfert réel désactivé", `insert into app.gifts(owner_id,experience_id,position,gift_type,status,amount,currency) values($1,$2,2,'MONEY','AWAITING_FUNDING',50,'USD')`, "MONEY_TRANSFERS_DISABLED", [u1, e2]);
await expectErr("statut initial invalide", `insert into app.gifts(owner_id,experience_id,position,gift_type,status) values($1,$2,3,'PHYSICAL','HANDED_OVER')`, "GIFT_INVALID_INITIAL_STATUS", [u1, e2]);
const gp = (await one(`insert into app.gifts(owner_id,experience_id,position,gift_type,status,data) values($1,$2,4,'PHYSICAL','ANNOUNCED','{"name":"Parfum"}') returning id`, [u1, e2])).id;
await expectErr("transition inexistante", `update app.gifts set status='PAST' where id=$1`, "GIFT_TRANSITION_NOT_ALLOWED", [gp]);
await expectOk("objet déclaré remis par l'expéditeur", `update app.gifts set status='HANDED_OVER' where id=$1`, [gp]);
(await one(`select count(*)::int n from app.gift_status_history where gift_id=$1`, [gp])).n === 2 ? ok("historique des statuts tenu") : ko("historique", "incomplet");
await db.query(`update app.app_settings set value='true' where key='gifts.money_transfers_enabled'`);
const gm = (await one(`insert into app.gifts(owner_id,experience_id,position,gift_type,status,amount,currency) values($1,$2,5,'MONEY','AWAITING_FUNDING',20,'USD') returning id`, [u1, e2])).id;
await expectErr("P6 : FUNDED refusé sans le prestataire", `update app.gifts set status='FUNDED' where id=$1`, "GIFT_TRANSITION_NOT_ALLOWED", [gm]);
await db.exec(`begin; set local app.actor='provider';`);
await expectOk("FUNDED posé par le prestataire", `update app.gifts set status='FUNDED' where id=$1`, [gm]);
await db.exec(`commit;`);
await db.query(`update app.app_settings set value='false' where key='gifts.money_transfers_enabled'`);

console.log("\nWebhooks :");
await expectOk("faux webhook stocké (signature invalide)", `insert into app.webhook_events(provider,provider_event_id,signature_valid,payload) values('mbiyopay','evt_1',false,'{}')`);
await expectOk("vrai webhook du même identifiant accepté ensuite", `insert into app.webhook_events(provider,provider_event_id,signature_valid,payload) values('mbiyopay','evt_1',true,'{}')`);
await expectErr("vrai webhook en double refusé (idempotence)", `insert into app.webhook_events(provider,provider_event_id,signature_valid,payload) values('mbiyopay','evt_1',true,'{}')`, "webhook_events_unique_valid_idx");

console.log("\nIA (S17) :");
const lf2 = (await one(`select app.ensure_free_license($1) id`, [u2])).id;
const g1 = (await one(`select app.reserve_ai_generation($1,$2,'birthday_message') id`, [u2, lf2])).id;
await expectOk("réservation 2/2", `select app.reserve_ai_generation($1,$2,'love_letter')`, [u2, lf2]);
await expectErr("quota IA épuisé", `select app.reserve_ai_generation($1,$2,'love_letter')`, "AI_QUOTA_EXCEEDED", [u2, lf2]);
await db.query(`select app.settle_ai_generation($1,false,null,null,null,null,'PROVIDER_ERROR')`, [g1]);
await expectOk("un échec libère le quota", `select app.reserve_ai_generation($1,$2,'love_letter')`, [u2, lf2]);

console.log("\nAudit et privilèges :");
await db.query(`insert into app.audit_log(actor_type,actor_id,action,entity_type,entity_id) values('user',$1,'experience.published','experience',$2)`, [u1, e1]);
await expectErr("journal d'audit en ajout seul (UPDATE)", `update app.audit_log set action='x.y'`, "AUDIT_LOG_IS_APPEND_ONLY");
await expectErr("journal d'audit en ajout seul (DELETE)", `delete from app.audit_log`, "AUDIT_LOG_IS_APPEND_ONLY");
await db.exec(`set role authenticated;`);
await expectErr("navigateur (authenticated) : aucune lecture", `select * from app.experiences`, "permission denied");
await db.exec(`reset role; set role anon;`);
await expectErr("navigateur (anon) : aucune lecture", `select * from app.licenses`, "permission denied");
await expectErr("navigateur (anon) : aucune fonction", `select app.ensure_free_license(gen_random_uuid())`, "permission denied");
await db.exec(`reset role; set role zaweli_api;`);
await expectOk("API (zaweli_api) : lecture autorisée", `select count(*) from app.experiences`);
await expectErr("API : UPDATE de l'audit retiré", `update app.audit_log set action='x.y'`, "permission denied");
await expectErr("API : modification d'un instantané retirée", `update app.experience_snapshots set revision=2`, "permission denied");
await db.exec(`reset role;`);

console.log(`\nRésultat : ${pass} réussis, ${fail} échoués.`);
process.exitCode = fail ? 1 : 0;

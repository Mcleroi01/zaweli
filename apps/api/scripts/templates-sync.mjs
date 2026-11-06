#!/usr/bin/env node
/**
 * Synchronise les manifestes des templates (code) vers la base
 * (app.templates / app.template_versions). À exécuter à chaque déploiement.
 *
 * Garanties (architecture A8) :
 *  - une version déjà en base dont l'empreinte change est REFUSÉE
 *    (une version publiée est immuable : il faut créer une nouvelle version) ;
 *  - une nouvelle version est insérée et devient la version courante ;
 *  - le statut commercial du template (draft / published) et ses étiquettes
 *    d'accès aux formules ne sont PAS touchés : ils relèvent de l'administration.
 *
 * Usage : pnpm templates:sync   (lit apps/api/.env en local)
 */
import pg from "pg";
import { manifestHash, validateManifest } from "@zaweli/template-engine/schema";
import { manifests as coffret } from "@zaweli/template-coffret";

const ALL_MANIFESTS = [...coffret];

if (process.env.NODE_ENV !== "production") {
  try {
    process.loadEnvFile(new URL("../.env", import.meta.url));
  } catch {
    /* variables fournies par l'environnement */
  }
}

const semverKey = (v) => v.split(".").map((n) => n.padStart(6, "0")).join(".");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let failures = 0;
for (const manifest of ALL_MANIFESTS) {
  const label = `${manifest.slug}@${manifest.version}`;
  const issues = validateManifest(manifest);
  if (issues.length) {
    console.error(`✗ ${label} : manifeste invalide\n  - ${issues.join("\n  - ")}`);
    failures++;
    continue;
  }
  const hash = await manifestHash(manifest);

  try {
    await client.query("begin");
    await client.query("set local app.actor = 'system'");

    const category = await client.query("select id from app.template_categories where slug = $1", [manifest.category]);
    if (!category.rowCount) throw new Error(`catégorie inconnue : ${manifest.category}`);

    const template = await client.query(
      `insert into app.templates (slug, name, description, category_id, audience)
       values ($1, $2, $3, $4, $5)
       on conflict (slug) do update
         set name = excluded.name, description = excluded.description,
             category_id = excluded.category_id, audience = excluded.audience
       returning id, status`,
      [manifest.slug, manifest.name, manifest.description, category.rows[0].id, manifest.audience],
    );
    const templateId = template.rows[0].id;

    const existing = await client.query(
      "select id, manifest_hash from app.template_versions where template_id = $1 and version = $2",
      [templateId, manifest.version],
    );

    if (existing.rowCount) {
      if (existing.rows[0].manifest_hash !== hash) {
        throw new Error(
          `TEMPLATE_VERSION_IMMUTABLE : ${label} existe déjà avec une autre empreinte. Créez une nouvelle version au lieu de modifier celle-ci.`,
        );
      }
      console.log(`= ${label} inchangé`);
    } else {
      await client.query(
        `insert into app.template_versions (template_id, version, renderer_key, manifest, manifest_hash, status, published_at)
         values ($1, $2, $3, $4, $5, 'published', now())`,
        [templateId, manifest.version, manifest.rendererKey, JSON.stringify(manifest), hash],
      );
      console.log(`+ ${label} ajouté (${hash.slice(0, 12)}…)`);
    }

    // Version courante = la plus haute version publiée.
    const versions = await client.query(
      "select id, version from app.template_versions where template_id = $1 and status = 'published'",
      [templateId],
    );
    const latest = versions.rows.sort((a, b) => semverKey(b.version).localeCompare(semverKey(a.version)))[0];
    await client.query("update app.templates set current_version_id = $1 where id = $2", [latest.id, templateId]);

    await client.query(
      `insert into app.audit_log (actor_type, action, entity_type, entity_id, data)
       values ('system', 'template.synced', 'template', $1, $2)`,
      [templateId, JSON.stringify({ version: manifest.version, hash })],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error(`✗ ${label} : ${error.message}`);
    failures++;
  }
}

await client.end();
process.exitCode = failures ? 1 : 0;

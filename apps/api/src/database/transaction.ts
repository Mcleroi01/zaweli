import { type Kysely, sql, type Transaction } from "kysely";
import type { Database } from "./database.types.js";

export type Db = Kysely<Database>;
export type Tx = Transaction<Database>;
export type Actor = "user" | "admin" | "system" | "provider";

/**
 * Transaction dans laquelle la base sait QUI agit (docs/04 §5, « acteur ») :
 * les déclencheurs SQL s'en servent pour refuser, par exemple, qu'un
 * utilisateur marque une commande « payée ». `set_config(…, true)` limite
 * la valeur à la transaction, comme `set local`.
 * Seul le traitement d'un webhook vérifié pourra utiliser « provider ».
 */
export function inTransaction<T>(db: Db, actor: Actor, actorId: string | null, work: (trx: Tx) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.actor', ${actor}, true), set_config('app.actor_id', ${actorId ?? ""}, true)`.execute(trx);
    return work(trx);
  });
}

export type AuditEntry = {
  actorType: "user" | "admin" | "system" | "provider" | "anonymous";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
  requestId?: string | null;
};

/** Journal d'audit en ajout seul (cahier des charges §11.4). Jamais de contenu personnel. */
export async function audit(db: Db | Tx, entry: AuditEntry): Promise<void> {
  await db
    .insertInto("app.audit_log")
    .values({
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      data: JSON.stringify(entry.data ?? {}),
      request_id: entry.requestId ?? null,
      ip_hash: null,
    })
    .execute();
}

/** Paramètre administrable (app.app_settings), avec une valeur par défaut. */
export async function readSetting<T>(db: Db | Tx, key: string, fallback: T): Promise<T> {
  const row = await db.selectFrom("app.app_settings").select("value").where("key", "=", key).executeTakeFirst();
  return row ? (row.value as T) : fallback;
}

export const toIso = (value: Date | string | null | undefined): string | null =>
  value == null ? null : (value instanceof Date ? value : new Date(value)).toISOString();

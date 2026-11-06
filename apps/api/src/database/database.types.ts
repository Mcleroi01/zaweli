/**
 * Types Kysely des tables utilisées par l'API.
 *
 * Seules les colonnes réellement interrogées sont décrites. Les migrations
 * SQL restent la source de vérité ; ce fichier sera généré (kysely-codegen)
 * quand l'API couvrira l'ensemble du modèle.
 */
import type { ColumnType } from "kysely";

export interface UserRolesTable {
  user_id: string;
  role: "admin" | "support";
  granted_at: Date;
  granted_by: string | null;
}

export interface ExperiencesTable {
  id: string;
  status: "draft" | "published" | "disabled" | "suspended" | "deleted";
  slug: string | null;
  current_snapshot_id: string | null;
  available_from: Date | null;
  access_code_hash: string | null;
}

export interface ExperienceSnapshotsTable {
  id: string;
  experience_id: string;
  template_version_id: string;
  public_payload: ColumnType<Record<string, unknown>, string, string>;
}

export interface TemplateVersionsTable {
  id: string;
  renderer_key: string;
}

export interface Database {
  "app.user_roles": UserRolesTable;
  "app.experiences": ExperiencesTable;
  "app.experience_snapshots": ExperienceSnapshotsTable;
  "app.template_versions": TemplateVersionsTable;
}

/**
 * Types Kysely des tables utilisées par l'API.
 *
 * Phase 5 : seules les tables réellement interrogées sont décrites.
 * Phase 6 : ce fichier sera GÉNÉRÉ depuis la base (kysely-codegen) pour ne
 * jamais diverger des migrations SQL, qui restent la source de vérité.
 */
export interface UserRolesTable {
  user_id: string;
  role: "admin" | "support";
  granted_at: Date;
  granted_by: string | null;
}

export interface Database {
  "app.user_roles": UserRolesTable;
}

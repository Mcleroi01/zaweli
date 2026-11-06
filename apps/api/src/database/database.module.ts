import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { ENV, type Env } from "../config/env.js";
import type { Database } from "./database.types.js";

export const DB = Symbol("DB");
export const PG_POOL = Symbol("PG_POOL");

/**
 * Connexion PostgreSQL de l'API (rôle zaweli_api via son utilisateur de
 * connexion). Kysely : requêtes typées, transactions et verrous explicites
 * (architecture A6).
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) =>
        new pg.Pool({
          connectionString: env.DATABASE_URL,
          max: env.DATABASE_POOL_MAX,
          application_name: `zaweli-api@${env.APP_VERSION}`,
        }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) => new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }),
    },
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async onApplicationShutdown() {
    await this.db.destroy();
  }
}

import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { HealthResponse } from "@zaweli/shared-types";
import type { Response } from "express";
import { type Kysely, sql } from "kysely";
import { Public } from "../auth/auth.guard.js";
import { ENV, type Env } from "../config/env.js";
import { DB } from "../database/database.module.js";
import type { Database } from "../database/database.types.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** GET /v1/health : 200 si la base répond, 503 sinon. */
  @Public()
  @SkipThrottle()
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const started = performance.now();
    let database: HealthResponse["checks"]["database"];
    try {
      await sql`select 1`.execute(this.db);
      database = { status: "ok", latencyMs: Math.round(performance.now() - started) };
    } catch {
      database = { status: "down" };
    }

    const status = database.status === "ok" ? "ok" : "down";
    if (status !== "ok") res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status, version: this.env.APP_VERSION, time: new Date().toISOString(), checks: { database } };
  }
}

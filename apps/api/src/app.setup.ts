import { randomUUID } from "node:crypto";
import { type INestApplication, StandardSchemaValidationPipe, VersioningType } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { ENV, type Env } from "./config/env.js";

/**
 * Configuration HTTP commune à main.ts et aux tests e2e : l'application
 * testée est exactement celle qui sera déployée.
 */
export function configureApp(app: INestApplication): INestApplication {
  const env = app.get<Env>(ENV);

  // Identifiant de requête propagé (journaux, réponses d'erreur).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    req.headers["x-request-id"] = id;
    res.setHeader("x-request-id", id);
    next();
  });

  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: false,
    allowedHeaders: ["authorization", "content-type", "idempotency-key", "x-request-id"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });

  // API versionnée par l'URI : /v1/...
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // Validation Zod native de NestJS 12 (Standard Schema).
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  app.enableShutdownHooks();
  return app;
}

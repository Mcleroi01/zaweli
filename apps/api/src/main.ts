import { ConsoleLogger, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { ENV, type Env } from "./config/env.js";

// En local, lit apps/api/.env (généré par `pnpm env:local`).
// En production, les variables viennent de l'hébergeur.
if (process.env.NODE_ENV !== "production") {
  try {
    process.loadEnvFile();
  } catch {
    // Pas de fichier .env : la validation de la configuration dira ce qui manque.
  }
}

const app = await NestFactory.create(AppModule, {
  logger: new ConsoleLogger({ json: process.env.NODE_ENV === "production", prefix: "zaweli-api" }),
});
configureApp(app);

const env = app.get<Env>(ENV);
await app.listen(env.PORT);
new Logger("Bootstrap").log(`API prête sur http://localhost:${env.PORT}/v1 (${env.NODE_ENV})`);

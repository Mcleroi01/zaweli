import { ConsoleLogger, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";

/**
 * Construit l'API prête à servir, SANS ouvrir de port :
 *  - main.ts l'écoute seule (développement, hébergeur dédié) ;
 *  - apps/web/server.mjs la monte sous /v1 dans le même processus que le site,
 *    quand l'hébergeur n'accepte qu'une application Node.js (Hostinger).
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    // Corps brut conservé pour vérifier la signature des webhooks MbiyoPay.
    rawBody: true,
    // Lever une erreur plutôt que quitter le processus : monté dans le serveur du
    // site, un échec de l'API ne doit pas faire tomber le site.
    abortOnError: false,
    logger: new ConsoleLogger({ json: process.env.NODE_ENV === "production", prefix: "zaweli-api" }),
  });
  configureApp(app);
  return app;
}

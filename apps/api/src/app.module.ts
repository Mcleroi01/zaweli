import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminController } from "./admin/admin.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { JwtVerifierService } from "./auth/jwt-verifier.service.js";
import { RolesGuard } from "./auth/roles.guard.js";
import { CatalogController } from "./catalog/catalog.controller.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { ExperiencesController } from "./experiences/experiences.controller.js";
import { ExperiencesService } from "./experiences/experiences.service.js";
import { HealthController } from "./health/health.controller.js";
import { LicensingService } from "./licensing/licensing.service.js";
import { MeController } from "./me/me.controller.js";
import { PublicExperiencesController } from "./public-experiences/public-experiences.controller.js";
import { RecipientsController } from "./recipients/recipients.controller.js";

@Module({
  imports: [
    ConfigModule,
    // Limitation de débit globale (affinée par route : publication, liens publics, signalements).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    DatabaseModule,
  ],
  controllers: [
    HealthController,
    MeController,
    CatalogController,
    RecipientsController,
    ExperiencesController,
    PublicExperiencesController,
    AdminController,
  ],
  providers: [
    JwtVerifierService,
    LicensingService,
    ExperiencesService,
    RolesGuard,
    // Ordre : limitation de débit, puis authentification.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}

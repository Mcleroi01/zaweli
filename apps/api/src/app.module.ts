import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthGuard } from "./auth/auth.guard.js";
import { JwtVerifierService } from "./auth/jwt-verifier.service.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { MeController } from "./me/me.controller.js";

@Module({
  imports: [
    ConfigModule,
    // Limitation de débit globale (affinée par route dans les phases suivantes).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    DatabaseModule,
  ],
  controllers: [HealthController, MeController],
  providers: [
    JwtVerifierService,
    // Ordre : limitation de débit, puis authentification.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}

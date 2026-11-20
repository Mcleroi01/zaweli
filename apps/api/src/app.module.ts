import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminController } from "./admin/admin.controller.js";
import { AiController } from "./ai/ai.controller.js";
import { AiProvider, OpenRouterProvider } from "./ai/ai.provider.js";
import { AiService } from "./ai/ai.service.js";
import { InsightsController } from "./admin/insights.controller.js";
import { InsightsService } from "./admin/insights.service.js";
import { PaymentsAdminController } from "./admin/payments-admin.controller.js";
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
import { AccountService, AuthAdmin, SupabaseAuthAdmin } from "./me/account.service.js";
import { MeController } from "./me/me.controller.js";
import { MediaController } from "./media/media.controller.js";
import { MediaService } from "./media/media.service.js";
import { StorageService, SupabaseStorage } from "./media/storage.service.js";
import { AudiusService } from "./music/audius.service.js";
import { MusicController } from "./music/music.controller.js";
import { MbiyoPayGateway, MobileMoneyGateway } from "./payments/mobile-money.gateway.js";
import { GiftClaimController, PaymentsController, WebhooksController } from "./payments/payments.controller.js";
import { PaymentsReconciler } from "./payments/payments.reconciler.js";
import { PaymentsService } from "./payments/payments.service.js";
import { MailService } from "./notifications/mail.service.js";
import { RemindersJob } from "./notifications/reminders.job.js";
import { ReferralsController } from "./referrals/referrals.controller.js";
import { ReferralsService } from "./referrals/referrals.service.js";
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
    InsightsController,
    PaymentsController,
    GiftClaimController,
    WebhooksController,
    MusicController,
    ReferralsController,
    MediaController,
    AiController,
    PaymentsAdminController,
  ],
  providers: [
    JwtVerifierService,
    LicensingService,
    ExperiencesService,
    InsightsService,
    PaymentsService,
    PaymentsReconciler,
    ReferralsService,
    MailService,
    RemindersJob,
    MediaService,
    { provide: StorageService, useClass: SupabaseStorage },
    AccountService,
    AiService,
    { provide: AiProvider, useClass: OpenRouterProvider },
    { provide: AuthAdmin, useClass: SupabaseAuthAdmin },
    AudiusService,
    { provide: MobileMoneyGateway, useClass: MbiyoPayGateway },
    RolesGuard,
    // Ordre : limitation de débit, puis authentification.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}

import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { ENV, type Env } from "../config/env.js";
import { MailService } from "./mail.service.js";

/** Rappels d'expiration des licences, une fois par heure (désactivé en test). */
@Injectable()
export class RemindersJob implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("Reminders");
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      this.mail.sendExpiryReminders().catch((e: unknown) => this.logger.warn(`rappels impossibles : ${(e as Error).message}`));
    }, 3600_000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}

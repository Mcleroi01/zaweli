import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { ENV, type Env } from "../config/env.js";
import { MobileMoneyGateway } from "./mobile-money.gateway.js";
import { PaymentsService } from "./payments.service.js";

/**
 * Revérification périodique des paiements restés en attente (docs/12) :
 * le filet de sécurité quand un webhook se perd et que personne n'ouvre la
 * page de suivi. Un passage à la fois ; désactivée en test et sans clé.
 */
@Injectable()
export class PaymentsReconciler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("Reconciler");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly gateway: MobileMoneyGateway,
    private readonly payments: PaymentsService,
  ) {}

  onApplicationBootstrap() {
    const seconds = this.env.PAYMENTS_RECONCILE_SECONDS;
    if (!seconds || this.env.NODE_ENV === "test" || this.gateway.mode === "disabled") return;
    this.timer = setInterval(() => void this.tick(), seconds * 1000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const { checked, settled } = await this.payments.reconcilePending();
      if (settled) this.logger.log(`${settled} paiement(s) mis à jour sur ${checked} vérifié(s)`);
    } catch (e) {
      this.logger.warn(`revérification impossible : ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}

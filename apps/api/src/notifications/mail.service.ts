import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Locale } from "@zaweli/shared-types";
import nodemailer, { type Transporter } from "nodemailer";
import { ENV, type Env } from "../config/env.js";
import { DB } from "../database/database.module.js";
import type { Db } from "../database/transaction.js";

type Mail = { subject: string; text: string };

const money = (amount: string, currency: string, locale: Locale) => {
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
};

/** Textes des e-mails transactionnels (tutoiement en français, comme l'espace client). */
const TEXT = {
  fr: {
    orderPaid: (plan: string, amount: string, url: string): Mail => ({
      subject: `Paiement confirmé : ta formule ${plan} est active`,
      text: `Bonjour,\n\nTon paiement de ${amount} est confirmé. Ta formule ${plan} est active : tu peux créer et publier tes expériences.\n\n${url}\n\nL'équipe Zaweli`,
    }),
    giftTransferred: (amount: string, recipient: string, url: string): Mail => ({
      subject: `${recipient} a reçu ton cadeau de ${amount}`,
      text: `Bonjour,\n\nLe transfert de ${amount} vers le mobile money de ${recipient} est confirmé.\n\n${url}\n\nL'équipe Zaweli`,
    }),
    licenseExpiring: (plan: string, date: string, url: string): Mail => ({
      subject: `Ta formule ${plan} se termine le ${date}`,
      text: `Bonjour,

Ta formule ${plan} se termine le ${date}. Après cette date, tu ne pourras plus créer ni modifier d'expérience avec elle ; celles déjà publiées restent accessibles.

${url}

Tu peux désactiver ces rappels dans Mon compte.

L'équipe Zaweli`,
    }),
    giftCard: (amount: string, threshold: number, url: string): Mail => ({
      subject: `Une carte cadeau de ${amount} t'attend`,
      text: `Bonjour,\n\nMerci : ${threshold} personnes ont rejoint Zaweli grâce à toi. Tu reçois une carte cadeau de ${amount}, utilisable pour payer une formule.\n\n${url}\n\nL'équipe Zaweli`,
    }),
  },
  en: {
    orderPaid: (plan: string, amount: string, url: string): Mail => ({
      subject: `Payment confirmed: your ${plan} plan is active`,
      text: `Hello,\n\nYour payment of ${amount} is confirmed. Your ${plan} plan is active: you can create and publish your experiences.\n\n${url}\n\nThe Zaweli team`,
    }),
    giftTransferred: (amount: string, recipient: string, url: string): Mail => ({
      subject: `${recipient} received your gift of ${amount}`,
      text: `Hello,\n\nThe transfer of ${amount} to ${recipient}'s mobile money is confirmed.\n\n${url}\n\nThe Zaweli team`,
    }),
    licenseExpiring: (plan: string, date: string, url: string): Mail => ({
      subject: `Your ${plan} plan ends on ${date}`,
      text: `Hello,

Your ${plan} plan ends on ${date}. After that date you can no longer create or edit experiences with it; those already published stay available.

${url}

You can turn off these reminders in My account.

The Zaweli team`,
    }),
    giftCard: (amount: string, threshold: number, url: string): Mail => ({
      subject: `A ${amount} gift card is waiting for you`,
      text: `Hello,\n\nThank you: ${threshold} people joined Zaweli thanks to you. You get a ${amount} gift card to pay for a plan.\n\n${url}\n\nThe Zaweli team`,
    }),
  },
} satisfies Record<Locale, unknown>;

/**
 * E-mails transactionnels (paiement confirmé, argent reçu, carte cadeau).
 * Envoyés APRÈS la validation en base, sans jamais bloquer ni annuler le
 * paiement : un échec d'envoi est journalisé. Sans SMTP_URL (développement),
 * l'e-mail est seulement écrit dans le journal.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");
  private readonly transport: Transporter | null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
  ) {
    this.transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;
  }

  async orderPaid(orderId: string): Promise<void> {
    const row = await this.db
      .selectFrom("app.orders as o")
      .innerJoin("app.plans as p", "p.id", "o.plan_id")
      .innerJoin("auth.users as u", "u.id", "o.user_id")
      .leftJoin("app.profiles as pr", "pr.id", "o.user_id")
      .select(["u.email", "pr.locale", "p.name", "o.amount", "o.list_amount", "o.currency"])
      .where("o.id", "=", orderId)
      .executeTakeFirst();
    if (!row?.email) return;
    const locale = row.locale ?? "fr";
    const mail = TEXT[locale].orderPaid(row.name, money(row.list_amount ?? row.amount, row.currency, locale), this.link(locale, "/espace/licences"));
    await this.send(row.email, mail);
  }

  async giftTransferred(transferId: string): Promise<void> {
    const row = await this.db
      .selectFrom("app.gift_transfers as t")
      .innerJoin("app.gifts as g", "g.id", "t.gift_id")
      .innerJoin("app.experiences as e", "e.id", "g.experience_id")
      .innerJoin("app.recipients as r", "r.id", "e.recipient_id")
      .innerJoin("auth.users as u", "u.id", "t.owner_id")
      .leftJoin("app.profiles as pr", "pr.id", "t.owner_id")
      .select(["u.email", "pr.locale", "t.amount", "t.currency", "r.display_name"])
      .where("t.id", "=", transferId)
      .executeTakeFirst();
    if (!row?.email) return;
    const locale = row.locale ?? "fr";
    await this.send(row.email, TEXT[locale].giftTransferred(money(row.amount, row.currency, locale), row.display_name, this.link(locale, "/espace/experiences")));
  }

  async giftCardGranted(cardId: string, threshold: number): Promise<void> {
    const row = await this.db
      .selectFrom("app.gift_cards as c")
      .innerJoin("auth.users as u", "u.id", "c.owner_id")
      .leftJoin("app.profiles as pr", "pr.id", "c.owner_id")
      .select(["u.email", "pr.locale", "c.amount", "c.currency"])
      .where("c.id", "=", cardId)
      .executeTakeFirst();
    if (!row?.email) return;
    const locale = row.locale ?? "fr";
    await this.send(row.email, TEXT[locale].giftCard(money(row.amount, row.currency, locale), threshold, this.link(locale, "/espace/parrainage")));
  }

  /**
   * Rappels d'expiration : licences actives qui se terminent dans les 3 jours,
   * une seule fois chacune, si la personne ne les a pas désactivés.
   */
  async sendExpiryReminders(limit = 100): Promise<number> {
    const rows = await this.db
      .selectFrom("app.licenses as l")
      .innerJoin("app.plans as p", "p.id", "l.plan_id")
      .innerJoin("auth.users as u", "u.id", "l.user_id")
      .innerJoin("app.profiles as pr", "pr.id", "l.user_id")
      .select(["l.id", "l.ends_at", "p.name", "u.email", "pr.locale"])
      .where("l.status", "=", "active")
      .where("l.expiry_reminded_at", "is", null)
      .where("l.ends_at", ">", new Date())
      .where("l.ends_at", "<=", new Date(Date.now() + 3 * 86_400_000))
      .where("pr.notify_license_expiry", "=", true)
      .where("pr.deleted_at", "is", null)
      .limit(limit)
      .execute();
    for (const row of rows) {
      // Marqué d'abord : un échec d'envoi ne provoque jamais de rafale de rappels.
      const claimed = await this.db.updateTable("app.licenses").set({ expiry_reminded_at: new Date() }).where("id", "=", row.id).where("expiry_reminded_at", "is", null).executeTakeFirst();
      if (!claimed.numUpdatedRows || !row.email || !row.ends_at) continue;
      const locale = row.locale ?? "fr";
      const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long" }).format(new Date(row.ends_at));
      await this.send(row.email, TEXT[locale].licenseExpiring(row.name, date, this.link(locale, "/espace/acheter")));
    }
    return rows.length;
  }

  private link(locale: Locale, path: string) {
    return `${this.env.PUBLIC_WEB_URL.replace(/\/+$/, "")}${locale === "en" ? "/en" : ""}${path}`;
  }

  private async send(to: string, mail: Mail): Promise<void> {
    if (!this.transport) {
      this.logger.log(`(sans SMTP) « ${mail.subject} »`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.env.MAIL_FROM, to, subject: mail.subject, text: mail.text });
    } catch (e) {
      this.logger.warn(`envoi impossible (« ${mail.subject} ») : ${(e as Error).message}`);
    }
  }
}

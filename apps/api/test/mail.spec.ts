/**
 * E-mails transactionnels : contenu et destinataire construits depuis la
 * vraie base (PGlite), avec un faux transport SMTP qui garde les messages.
 */
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/config/env.js";
import { MailService } from "../src/notifications/mail.service.js";
import { createTestDatabase } from "./support/pglite.js";

let pg: PGlite;
let mail: MailService;
const sent: Array<{ to: string; subject: string; text: string }> = [];

beforeAll(async () => {
  const database = await createTestDatabase();
  pg = database.pg;
  mail = new MailService({ PUBLIC_WEB_URL: "https://zaweli.store", MAIL_FROM: "Zaweli <bonjour@zaweli.store>" } as Env, database.db);
  // Faux transport : on garde ce qui aurait été envoyé.
  (mail as unknown as { transport: unknown }).transport = { sendMail: async (m: { to: string; subject: string; text: string }) => void sent.push(m) };
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

async function user(locale: "fr" | "en") {
  const id = randomUUID();
  await pg.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@zaweli.test`]);
  await pg.query("insert into app.profiles (id, locale) values ($1, $2) on conflict (id) do update set locale = excluded.locale", [id, locale]);
  return id;
}

describe("E-mails transactionnels", () => {
  it("confirme un paiement dans la langue du compte, avec le prix de la formule", async () => {
    await pg.query(`insert into app.plans (code, name, is_active, is_public, template_access_mode) values ('SOLO', 'Solo', true, true, 'all')`);
    await pg.query("insert into app.plan_prices (plan_id, currency, amount) select id, 'USD', 5 from app.plans where code = 'SOLO'");
    const id = await user("fr");
    const order = await pg.query<{ id: string }>(
      `insert into app.orders (user_id, plan_id, plan_price_id, amount, list_amount, discount_amount, currency, idempotency_key, provider)
       select $1, p.id, pp.id, 4, 5, 1, 'USD', 'mail-test-1', 'mbiyopay' from app.plans p join app.plan_prices pp on pp.plan_id = p.id where p.code = 'SOLO'
       returning id`,
      [id],
    );
    await mail.orderPaid(order.rows[0]!.id);
    const m = sent.at(-1)!;
    expect(m.to).toBe(`${id}@zaweli.test`);
    expect(m.subject).toBe("Paiement confirmé : ta formule Solo est active");
    expect(m.text).toContain("5,00");
    expect(m.text).toContain("https://zaweli.store/espace/licences");
  });

  it("annonce une carte cadeau de parrainage, en anglais pour un compte anglais", async () => {
    const id = await user("en");
    const card = await pg.query<{ id: string }>(
      "insert into app.gift_cards (owner_id, amount, balance, currency, source, source_ref) values ($1, 10, 10, 'USD', 'referral', 'referral:50') returning id",
      [id],
    );
    await mail.giftCardGranted(card.rows[0]!.id, 50);
    const m = sent.at(-1)!;
    expect(m.subject).toBe("A $10.00 gift card is waiting for you");
    expect(m.text).toContain("50 people joined Zaweli");
    expect(m.text).toContain("https://zaweli.store/en/espace/parrainage");
  });
});

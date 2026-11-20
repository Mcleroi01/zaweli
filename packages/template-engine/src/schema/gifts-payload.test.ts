import { describe, expect, it } from "vitest";
import {
  buildPublicPayload,
  checkRiddleAnswer,
  compileContentSchema,
  defineManifest,
  describeGift,
  f,
  giftDataSchemas,
  type PublicGift,
  type PublicRiddle,
} from "./index.js";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("giftDataSchemas", () => {
  it("valide chaque type avec ses propres champs", () => {
    expect(giftDataSchemas.MONEY.safeParse({ amount: 50, currency: "USD", receptionMode: "in_person" }).success).toBe(true);
    expect(giftDataSchemas.MONEY.safeParse({ amount: -1, currency: "USD", receptionMode: "in_person" }).success).toBe(false);
    expect(giftDataSchemas.INVITATION.safeParse({ title: "Dîner", place: "Rotana", date: "2026-11-14", time: "17:00" }).success).toBe(true);
    expect(giftDataSchemas.INVITATION.safeParse({ title: "Dîner", place: "Rotana", date: "14/11/2026" }).success).toBe(false);
  });

  it("refuse un champ non prévu (pas de saisie libre)", () => {
    expect(giftDataSchemas.PHYSICAL.safeParse({ name: "Parfum", html: "<b>x</b>" }).success).toBe(false);
  });

  it("n'accepte que des liens de carte https sur des domaines connus", () => {
    const base = { title: "Dîner", place: "Rotana", date: "2026-11-14" };
    expect(giftDataSchemas.INVITATION.safeParse({ ...base, mapUrl: "https://maps.app.goo.gl/abc" }).success).toBe(true);
    expect(giftDataSchemas.INVITATION.safeParse({ ...base, mapUrl: "http://maps.app.goo.gl/abc" }).success).toBe(false);
    expect(giftDataSchemas.INVITATION.safeParse({ ...base, mapUrl: "https://arnaque.example/maps" }).success).toBe(false);
  });

  it("le code d'un bon n'est pas un champ public", () => {
    expect(giftDataSchemas.VOUCHER.safeParse({ title: "Massage", code: "ABC-123" }).success).toBe(false);
  });
});

describe("describeGift : la vérité avant tout (P6)", () => {
  it("un cadeau d'argent annoncé reste une promesse", () => {
    const d = describeGift({ id: ID(1), type: "MONEY", status: "ANNOUNCED", data: { amount: 50, currency: "USD", receptionMode: "in_person" } });
    expect(d.title).toBe("50 USD");
    expect(d.note).toMatch(/promesse/i);
    expect(JSON.stringify(d)).not.toMatch(/transféré|payé|livré/i);
  });

  it("seul un transfert confirmé est présenté comme tel", () => {
    const d = describeGift({ id: ID(1), type: "MONEY", status: "TRANSFERRED", data: { amount: 50, currency: "USD", receptionMode: "other" } });
    expect(d.note).toBe("Transfert confirmé.");
  });

  it("un cadeau versé via ZAWELI propose de le recevoir, sans jamais se dire reçu avant confirmation", () => {
    const money = (status: string) =>
      describeGift({ id: ID(1), type: "MONEY", status, data: { amount: 20, currency: "USD", receptionMode: "zaweli_transfer" } });
    expect(money("AWAITING_CLAIM").action).toEqual({ kind: "claim", label: "Recevoir l'argent" });
    expect(money("FAILED").action?.kind).toBe("claim");
    expect(money("TRANSFER_PENDING").note).toBe("Envoi en cours vers ton mobile money.");
    expect(money("TRANSFER_PENDING").action).toBeUndefined();
    expect(money("TRANSFERRED").note).toBe("Transfert confirmé.");
    expect(money("TRANSFERRED").action).toBeUndefined();
    for (const status of ["AWAITING_CLAIM", "FAILED", "TRANSFER_PENDING"]) expect(money(status).note).not.toMatch(/confirmé/);
  });

  it("formate une invitation en français", () => {
    const d = describeGift({
      id: ID(2),
      type: "INVITATION",
      status: "ANNOUNCED",
      data: { title: "Un dîner", place: "Rotana Hotel", date: "2026-11-14", time: "17:00" },
    });
    expect(d.lines[0]).toBe("14 novembre 2026 à 17 h 00");
    expect(d.lines).toContain("Rotana Hotel");
  });
});

describe("buildPublicPayload", () => {
  const manifest = defineManifest({
    slug: "mini",
    version: "1.0.0",
    rendererKey: "mini@1.0.0",
    name: "Mini",
    category: "anniversaire",
    description: "Test",
    audience: "personal",
    steps: [{ id: "all", title: "Tout", fields: ["name", "portrait", "riddles", "gifts"] }],
    sections: [{ id: "main", optional: false }],
    fields: {
      name: f.shortText({ label: "Prénom", required: true, max: 24 }),
      portrait: f.photo({ label: "Portrait", ratio: "2:3", required: true }),
      riddles: f.riddleList({
        label: "Énigmes", min: 1, max: 3, choices: 3, questionMax: 200, choiceMax: 30, hintMax: 100, revealMax: 80,
        photo: { required: false, ratio: "2:3" },
      }),
      gifts: f.giftList({ label: "Cadeaux", min: 1, max: 3, types: ["PHYSICAL"] }),
    },
    media: { maxPhotos: 6 },
    progression: { mode: "sequential", restartable: true },
  });

  const content = compileContentSchema(manifest, "publish").parse({
    fields: {
      name: "Pauline",
      portrait: { mediaId: ID(10), alt: "Portrait" },
      riddles: [{ question: "Quoi ?", choices: ["A", "B", "C"], answer: 1, reveal: "Bravo" }],
      gifts: [ID(20)],
    },
  });
  const gift: PublicGift = { id: ID(20), type: "PHYSICAL", status: "ANNOUNCED", data: { name: "Parfum" } };
  const ctx = { salt: "sel-de-test", gifts: [gift], resolvePhoto: (id: string) => ({ src: `https://cdn.test/${id}.webp` }) };

  it("résout les photos et les cadeaux", async () => {
    const payload = await buildPublicPayload(manifest, content, ctx);
    expect(payload.fields.portrait).toEqual({ src: `https://cdn.test/${ID(10)}.webp`, alt: "Portrait" });
    expect(payload.fields.gifts).toEqual([gift]);
    expect(payload.rendererKey).toBe("mini@1.0.0");
  });

  it("ne livre pas la bonne réponse en clair, mais permet de la vérifier", async () => {
    const payload = await buildPublicPayload(manifest, content, ctx);
    const [riddle] = payload.fields.riddles as PublicRiddle[];
    expect(JSON.stringify(riddle)).not.toContain('"answer"');
    expect(await checkRiddleAnswer(payload, 0, riddle!, 1)).toBe(true);
    expect(await checkRiddleAnswer(payload, 0, riddle!, 0)).toBe(false);
  });

  it("refuse un cadeau d'un type non accepté par le template", async () => {
    const money: PublicGift = { id: ID(20), type: "MONEY", status: "ANNOUNCED", data: { amount: 5, currency: "USD", receptionMode: "other" } };
    await expect(buildPublicPayload(manifest, content, { ...ctx, gifts: [money] })).rejects.toThrow(/non accepté/);
  });

  it("la publication refuse une énigme aux propositions en double", () => {
    const res = compileContentSchema(manifest, "publish").safeParse({
      fields: { ...content.fields, riddles: [{ question: "Q", choices: ["A", "a", "C"], answer: 0, reveal: "R" }] },
    });
    expect(res.success).toBe(false);
  });
});

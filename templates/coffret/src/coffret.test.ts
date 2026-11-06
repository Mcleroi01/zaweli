import { describe, expect, it } from "vitest";
import {
  buildPublicPayload,
  checkRiddleAnswer,
  compileContentSchema,
  manifestHash,
  validateManifest,
  type PublicGift,
  type PublicRiddle,
} from "@zaweli/template-engine/schema";
import { coffretDemoPayload, coffretV1 } from "./index.js";

/**
 * GARDE-FOU D'IMMUTABILITÉ (architecture A8).
 * Coffret 1.0.0 est une version publiée : son manifeste ne doit plus bouger.
 * Si ce test échoue, ne changez PAS l'empreinte : créez une version 1.0.1 / 1.1.0.
 */
const COFFRET_1_0_0_HASH = "78e3cf4d3cbaed57d24de0c2196a3d58c4737de3f5da0569348a2b79d50eeb8f";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const photo = (n: number) => ({ mediaId: ID(n), alt: `Photo ${n}` });

const validContent = {
  fields: {
    name: "Pauline",
    sealCard: "Aujourd'hui, tout ce qui se trouve ici t'appartient.",
    sealCta: "Je suis prête",
    jewelTitle: "Il est fermé depuis ce matin.",
    jewelPhoto: photo(1),
    jewelReveal: "Dedans, rien de plus précieux que toi.",
    riddles: [{ question: "Q ?", choices: ["A", "B", "C"], answer: 2, photo: photo(2), reveal: "Bravo" }],
    giftsTitle: "Un cadeau pour toi",
    gifts: [ID(50)],
    celebrationPhoto: photo(3),
    wishes: ["Joie", "Paix", "Santé", "Audace", "Réussite", "Douceur", "Voyages", "Rires"],
    wishesDone: "Que chacun de ces vœux trouve sa place.",
    finalePhoto: photo(4),
    finaleLine: "Belle, forte et lumineuse.",
    finaleLetter: "Je voulais t'offrir un moment, pas seulement un message.",
    finaleSignoff: "Avec affection.",
  },
};

describe("Coffret 1.0.0", () => {
  it("le manifeste est valide", () => {
    expect(validateManifest(coffretV1)).toEqual([]);
  });

  it("le manifeste publié n'a pas changé (immutabilité)", async () => {
    expect(await manifestHash(coffretV1)).toBe(COFFRET_1_0_0_HASH);
  });

  it("accepte un contenu complet et refuse ce qui sort du cadre", () => {
    const publish = compileContentSchema(coffretV1, "publish");
    expect(publish.safeParse(validContent).success).toBe(true);
    // Exactement 8 vœux (8 ballons dans le design).
    expect(publish.safeParse({ fields: { ...validContent.fields, wishes: ["Joie"] } }).success).toBe(false);
    // Pas plus de 3 cadeaux, pas plus de 3 énigmes.
    expect(publish.safeParse({ fields: { ...validContent.fields, gifts: [ID(1), ID(2), ID(3), ID(4)] } }).success).toBe(false);
    // Seules les sections facultatives peuvent être masquées.
    expect(publish.safeParse({ ...validContent, disabledSections: ["jewel", "gifts"] }).success).toBe(true);
    expect(publish.safeParse({ ...validContent, disabledSections: ["finale"] }).success).toBe(false);
  });

  it("du contenu validé à la charge publique", async () => {
    const content = compileContentSchema(coffretV1, "publish").parse(validContent);
    const gift: PublicGift = { id: ID(50), type: "EXPERIENCE", status: "ANNOUNCED", data: { title: "Un week-end" } };
    const payload = await buildPublicPayload(coffretV1, content, {
      salt: "s",
      gifts: [gift],
      resolvePhoto: (id) => ({ src: `/media/${id}.webp` }),
    });
    expect(payload.rendererKey).toBe("coffret@1.0.0");
    const [riddle] = payload.fields.riddles as PublicRiddle[];
    expect(await checkRiddleAnswer(payload, 0, riddle!, 2)).toBe(true);
  });

  it("la démonstration n'utilise aucune photo réelle et ses énigmes sont résolubles", async () => {
    const demo = await coffretDemoPayload();
    expect(JSON.stringify(demo)).not.toMatch(/portrait-0\d|\.webp|\.jpe?g/);
    for (const id of Object.keys(coffretV1.fields)) {
      if (id === "age" || id === "from") continue;
      expect(demo.fields[id], `champ de démonstration manquant : ${id}`).toBeDefined();
    }
    const riddles = demo.fields.riddles as PublicRiddle[];
    for (const [i, r] of riddles.entries()) expect(await checkRiddleAnswer(demo, i, r, 1)).toBe(true);
  });
});

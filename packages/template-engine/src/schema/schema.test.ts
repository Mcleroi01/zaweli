import { describe, expect, it } from "vitest";
import { canonicalJson, compileContentSchema, defineManifest, f, manifestHash, validateManifest } from "./index.js";
import type { TemplateManifest } from "./index.js";

const PHOTO_ID = "6f1c1d1e-9f0a-4c55-8a3e-2b3f4a5b6c7d";
const GIFT_A = "0b6c8d1e-1111-4c55-8a3e-2b3f4a5b6c7d";
const GIFT_B = "0b6c8d1e-2222-4c55-8a3e-2b3f4a5b6c7d";

const manifest = defineManifest({
  slug: "exemple",
  version: "1.0.0",
  rendererKey: "exemple@1.0.0",
  name: "Exemple",
  category: "anniversaire",
  description: "Manifeste de test.",
  audience: "personal",
  steps: [
    { id: "recipient", title: "Pour qui ?", fields: ["name", "age"] },
    { id: "content", title: "Contenu", fields: ["letter", "portrait", "wishes", "gifts", "mood", "showAge"] },
  ],
  sections: [
    { id: "intro", optional: false },
    { id: "gifts", optional: true },
  ],
  fields: {
    name: f.shortText({ label: "Prénom", required: true, max: 24 }),
    age: f.integer({ label: "Âge", min: 1, max: 120 }),
    letter: f.longText({ label: "Lettre", required: true, min: 20, max: 600, aiAssist: true }),
    portrait: f.photo({ label: "Portrait", ratio: "2:3", required: true }),
    wishes: f.wordList({ label: "Vœux", exactly: 3, maxEach: 14 }),
    gifts: f.giftList({ label: "Cadeaux", min: 1, max: 3, types: ["PHYSICAL", "MONEY"] }),
    mood: f.select({ label: "Ambiance", options: [{ value: "tendre", label: "Tendre" }, { value: "festive", label: "Festive" }] }),
    showAge: f.toggle({ label: "Afficher l'âge" }),
  },
  media: { maxPhotos: 6 },
  progression: { mode: "sequential", restartable: true },
});

const complete = {
  fields: {
    name: "Pauline",
    age: 25,
    letter: "Je voulais t'offrir un moment, pas seulement un message.",
    portrait: { mediaId: PHOTO_ID, alt: "Pauline en robe à pois" },
    wishes: ["Joie", "Paix", "Audace"],
    gifts: [GIFT_A],
    mood: "tendre",
    showAge: true,
  },
};

describe("DSL des champs", () => {
  it("refuse des bornes incohérentes", () => {
    expect(() => f.shortText({ label: "x", min: 10, max: 5 })).toThrow();
    expect(() => f.giftList({ label: "x", min: 0, max: 2, types: [] })).toThrow();
    expect(() => f.select({ label: "x", options: [{ value: "a", label: "A" }, { value: "a", label: "B" }] })).toThrow();
  });

  it("wordList exactly fixe min = max", () => {
    expect(f.wordList({ label: "x", exactly: 8, maxEach: 10 })).toMatchObject({ min: 8, max: 8 });
  });
});

describe("validateManifest", () => {
  it("accepte un manifeste cohérent", () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it("détecte les incohérences", () => {
    const broken: TemplateManifest = {
      ...manifest,
      rendererKey: "autre@1.0.0",
      steps: [
        { id: "a", title: "A", fields: ["name", "inconnu"] },
        { id: "a", title: "A bis", fields: ["name"] },
      ],
    };
    const issues = validateManifest(broken).join("\n");
    expect(issues).toContain("rendererKey");
    expect(issues).toContain("champ inconnu : inconnu");
    expect(issues).toContain("étape en double : a");
    expect(issues).toContain("apparaît dans deux étapes");
    expect(issues).toContain("n'apparaît dans aucune étape");
    expect(() => defineManifest(broken)).toThrow(/invalide/);
  });
});

describe("compileContentSchema", () => {
  const draft = compileContentSchema(manifest, "draft");
  const publish = compileContentSchema(manifest, "publish");

  it("un brouillon vide est valide", () => {
    expect(draft.safeParse({ fields: {} }).success).toBe(true);
  });

  it("un brouillon applique quand même les bornes supérieures", () => {
    expect(draft.safeParse({ fields: { name: "x".repeat(25) } }).success).toBe(false);
    expect(draft.safeParse({ fields: { gifts: [GIFT_A, GIFT_B, GIFT_A] } }).success).toBe(false);
  });

  it("refuse un champ non prévu par le template", () => {
    expect(draft.safeParse({ fields: { couleur: "#ff0000" } }).success).toBe(false);
    expect(draft.safeParse({ fields: {}, css: "body{}" }).success).toBe(false);
  });

  it("la publication exige les champs obligatoires et les minimums", () => {
    expect(publish.safeParse({ fields: {} }).success).toBe(false);
    expect(publish.safeParse(complete).success).toBe(true);
    expect(publish.safeParse({ fields: { ...complete.fields, letter: "trop court" } }).success).toBe(false);
    expect(publish.safeParse({ fields: { ...complete.fields, wishes: ["Joie"] } }).success).toBe(false);
    expect(publish.safeParse({ fields: { ...complete.fields, gifts: [] } }).success).toBe(false);
  });

  it("une photo exige un texte alternatif", () => {
    const noAlt = { fields: { ...complete.fields, portrait: { mediaId: PHOTO_ID, alt: "  " } } };
    expect(publish.safeParse(noAlt).success).toBe(false);
  });

  it("seules les sections facultatives peuvent être masquées", () => {
    expect(publish.safeParse({ ...complete, disabledSections: ["gifts"] }).success).toBe(true);
    expect(publish.safeParse({ ...complete, disabledSections: ["intro"] }).success).toBe(false);
  });

  it("une option hors liste est refusée", () => {
    expect(publish.safeParse({ fields: { ...complete.fields, mood: "neon" } }).success).toBe(false);
  });
});

describe("manifestHash", () => {
  it("ne dépend pas de l'ordre des clés", async () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
    const reordered = Object.fromEntries(Object.entries(manifest).reverse());
    expect(await manifestHash(reordered)).toBe(await manifestHash(manifest));
  });

  it("change dès qu'un détail change", async () => {
    const h1 = await manifestHash(manifest);
    const h2 = await manifestHash({ ...manifest, name: "Exemple 2" });
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(h2).not.toBe(h1);
  });
});

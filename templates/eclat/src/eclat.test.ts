import { describe, expect, it } from "vitest";
import { compileContentSchema, manifestHash, validateManifest } from "@zaweli/template-engine/schema";
import { eclatDemoPayload, eclatV1 } from "./index.js";

/** GARDE-FOU D'IMMUTABILITÉ : Éclat 1.0.0 publié ne doit plus changer. */
const ECLAT_1_0_0_HASH = "1474ddd834a19bdb546f7093048b23b9c075ea058d6a6f3631baad07a78fb7f0";

describe("Éclat 1.0.0", () => {
  it("le manifeste est valide et figé", async () => {
    expect(validateManifest(eclatV1)).toEqual([]);
    expect(await manifestHash(eclatV1)).toBe(ECLAT_1_0_0_HASH);
  });

  it("seules les sections facultatives peuvent être masquées", () => {
    const draft = compileContentSchema(eclatV1, "draft");
    expect(draft.safeParse({ fields: {}, disabledSections: ["gallery", "letter", "achievement", "magic"] }).success).toBe(true);
    expect(draft.safeParse({ fields: {}, disabledSections: ["final"] }).success).toBe(false);
  });

  it("borne la galerie à 10 photos", () => {
    const photo = { mediaId: "00000000-0000-4000-8000-000000000001", alt: "x" };
    const draft = compileContentSchema(eclatV1, "draft");
    expect(draft.safeParse({ fields: { galleryPhotos: Array(10).fill(photo) } }).success).toBe(true);
    expect(draft.safeParse({ fields: { galleryPhotos: Array(11).fill(photo) } }).success).toBe(false);
  });

  it("la démonstration est fictive et complète", async () => {
    const demo = await eclatDemoPayload();
    expect(JSON.stringify(demo)).not.toMatch(/fifi|mambali|\.webp|\.jpe?g/i);
    for (const [id, def] of Object.entries(eclatV1.fields)) {
      if ("required" in def && def.required) expect(demo.fields[id], id).toBeDefined();
    }
  });
});

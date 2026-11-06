import { z } from "zod";
import type { FieldDef } from "./fields.js";
import type { TemplateManifest } from "./manifest.js";

/**
 * - "draft"   : enregistrement d'un brouillon. Tout est facultatif, mais les
 *               bornes supérieures (longueurs, nombres) restent appliquées.
 * - "publish" : avant publication. Champs obligatoires et bornes inférieures
 *               appliqués.
 */
export type ValidationMode = "draft" | "publish";

/** Valeur d'un champ photo : référence vers app.media_assets et texte alternatif. */
export const photoValueSchema = z.strictObject({
  mediaId: z.uuid(),
  alt: z.string().trim().min(1),
});

function fieldSchema(def: FieldDef, mode: ValidationMode): z.ZodType {
  const publish = mode === "publish";

  switch (def.kind) {
    case "shortText":
    case "longText": {
      const min = publish ? Math.max(def.min, def.required ? 1 : 0) : 0;
      return z.string().trim().min(min).max(def.max);
    }
    case "integer":
      return z.number().int().min(def.min).max(def.max);
    case "select":
      return z.enum(def.options.map((o) => o.value) as [string, ...string[]]);
    case "toggle":
      return z.boolean();
    case "photo":
      return photoValueSchema.extend({ alt: z.string().trim().min(1).max(def.altMax) });
    case "wordList":
      return z
        .array(z.string().trim().min(1).max(def.maxEach))
        .min(publish ? def.min : 0)
        .max(def.max);
    case "giftList":
      // Identifiants de lignes app.gifts ; le type de chaque cadeau est
      // contrôlé côté serveur contre def.types.
      return z
        .array(z.uuid())
        .min(publish ? def.min : 0)
        .max(def.max)
        .refine((ids) => new Set(ids).size === ids.length, "cadeau en double");
  }
}

function isRequired(def: FieldDef): boolean {
  switch (def.kind) {
    case "toggle":
      return false;
    case "wordList":
    case "giftList":
      return def.min > 0;
    default:
      return def.required;
  }
}

/**
 * Compile le schéma Zod du CONTENU d'une expérience pour une version de
 * template. Les clés inconnues sont refusées (pas de champ non prévu).
 */
export function compileContentSchema(manifest: TemplateManifest, mode: ValidationMode) {
  const shape: Record<string, z.ZodType> = {};
  for (const [id, def] of Object.entries(manifest.fields)) {
    const schema = fieldSchema(def, mode);
    shape[id] = mode === "publish" && isRequired(def) ? schema : schema.optional();
  }

  const optionalSections = manifest.sections.filter((s) => s.optional).map((s) => s.id);

  return z.strictObject({
    fields: z.strictObject(shape),
    /** Sections masquées par l'expéditeur : uniquement parmi les facultatives. */
    disabledSections: z
      .array(optionalSections.length > 0 ? z.enum(optionalSections as [string, ...string[]]) : z.never())
      .max(optionalSections.length)
      .default([]),
  });
}

export type CompiledContent = z.infer<ReturnType<typeof compileContentSchema>>;

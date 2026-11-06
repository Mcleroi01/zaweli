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
    case "riddleList": {
      const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
      const photo = photoValueSchema.extend({ alt: z.string().trim().min(1).max(140) });
      const riddle = z
        .strictObject({
          question: text(def.questionMax, publish ? 1 : 0),
          choices: z.array(text(def.choiceMax, publish ? 1 : 0)).length(def.choices),
          answer: z.number().int().min(0).max(def.choices - 1),
          hint: text(def.hintMax).optional(),
          photo: publish && def.photo.required ? photo : photo.optional(),
          reveal: text(def.revealMax, publish ? 1 : 0),
        })
        .refine(
          (r) => !publish || new Set(r.choices.map((c) => c.toLocaleLowerCase("fr"))).size === r.choices.length,
          "propositions en double",
        );
      return z.array(riddle).min(publish ? def.min : 0).max(def.max);
    }
    case "textList":
      return z
        .array(z.string().trim().min(1).max(def.maxEach))
        .min(publish ? def.min : 0)
        .max(def.max);
    case "photoList":
      return z
        .array(
          photoValueSchema.extend({
            alt: z.string().trim().min(1).max(140),
            caption: z.string().trim().max(def.captionMax).optional(),
          }),
        )
        .min(publish ? def.min : 0)
        .max(def.max);
    case "entryList":
      return z
        .array(z.strictObject({ title: z.string().trim().min(1).max(def.titleMax), text: z.string().trim().max(def.textMax) }))
        .min(publish ? def.min : 0)
        .max(def.max);
  }
}

function isRequired(def: FieldDef): boolean {
  switch (def.kind) {
    case "toggle":
      return false;
    case "wordList":
    case "giftList":
    case "riddleList":
    case "textList":
    case "photoList":
    case "entryList":
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

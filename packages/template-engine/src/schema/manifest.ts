import type { FieldDef } from "./fields.js";

/**
 * Manifeste d'une version de template : la description complète de ce qu'un
 * template accepte. Donnée pure, sérialisable, copiée en base au déploiement.
 */
export type TemplateManifest = {
  slug: string;
  version: string;
  /** Doit valoir `${slug}@${version}` : clé du renderer dans le registre web. */
  rendererKey: string;
  name: string;
  category: string;
  description: string;
  audience: "personal" | "business";
  /** Étapes de l'assistant de création, dans l'ordre. */
  steps: ReadonlyArray<{ id: string; title: string; fields: readonly string[] }>;
  /** Scènes de l'expérience ; seules celles marquées optional peuvent être masquées. */
  sections: ReadonlyArray<{ id: string; optional: boolean }>;
  fields: Readonly<Record<string, FieldDef>>;
  media: { maxPhotos: number };
  progression: { mode: "sequential"; restartable: boolean };
};

/** Identité typée : aide à l'autocomplétion, valide à l'exécution. */
export function defineManifest<const M extends TemplateManifest>(manifest: M): M {
  const issues = validateManifest(manifest);
  if (issues.length > 0) {
    throw new Error(`Manifeste ${manifest.slug}@${manifest.version} invalide :\n- ${issues.join("\n- ")}`);
  }
  return manifest;
}

const SLUG = /^[a-z0-9-]{2,40}$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const ID = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

/** Renvoie la liste des problèmes (vide si le manifeste est valide). */
export function validateManifest(m: TemplateManifest): string[] {
  const issues: string[] = [];

  if (!SLUG.test(m.slug)) issues.push(`slug invalide : ${m.slug}`);
  if (!SEMVER.test(m.version)) issues.push(`version non semver : ${m.version}`);
  if (m.rendererKey !== `${m.slug}@${m.version}`) {
    issues.push(`rendererKey doit valoir ${m.slug}@${m.version} (reçu ${m.rendererKey})`);
  }

  const fieldIds = Object.keys(m.fields);
  for (const id of fieldIds) if (!ID.test(id)) issues.push(`identifiant de champ invalide : ${id}`);

  const stepIds = new Set<string>();
  const placed = new Map<string, string>();
  for (const step of m.steps) {
    if (stepIds.has(step.id)) issues.push(`étape en double : ${step.id}`);
    stepIds.add(step.id);
    if (step.fields.length === 0) issues.push(`étape vide : ${step.id}`);
    for (const field of step.fields) {
      if (!(field in m.fields)) issues.push(`l'étape ${step.id} référence un champ inconnu : ${field}`);
      const previous = placed.get(field);
      if (previous) issues.push(`le champ ${field} apparaît dans deux étapes (${previous}, ${step.id})`);
      placed.set(field, step.id);
    }
  }
  for (const id of fieldIds) if (!placed.has(id)) issues.push(`le champ ${id} n'apparaît dans aucune étape`);

  const sectionIds = new Set<string>();
  for (const s of m.sections) {
    if (sectionIds.has(s.id)) issues.push(`section en double : ${s.id}`);
    sectionIds.add(s.id);
  }
  if (m.sections.length === 0) issues.push("au moins une section est requise");

  const photoFields = Object.values(m.fields).filter((x) => x.kind === "photo").length;
  if (photoFields > m.media.maxPhotos) {
    issues.push(`${photoFields} champs photo pour media.maxPhotos = ${m.media.maxPhotos}`);
  }

  return issues;
}

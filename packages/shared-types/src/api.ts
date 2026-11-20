/**
 * Contrats de l'API métier (/v1) : schémas des requêtes (validés par l'API
 * et réutilisables par les formulaires web) et types des réponses.
 */
import { z } from "zod";
import { countryCodeSchema } from "./geo.js";
import { giftTypeSchema } from "./gifts.js";
import { type MusicChoice, musicChoiceSchema } from "./music.js";
import { localeSchema, translationsSchema, type Locale } from "./i18n.js";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

// ---------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------

export const updateProfileSchema = z
  .strictObject({
    displayName: trimmed(1, 80).nullable().optional(),
    locale: localeSchema.optional(),
    marketingOptIn: z.boolean().optional(),
    /** E-mail de rappel quelques jours avant la fin d'une licence. */
    notifyLicenseExpiry: z.boolean().optional(),
    /** Pays déclaré par l'utilisateur (ISO 3166-1 alpha-2), ou null pour l'effacer. */
    countryCode: countryCodeSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "au moins un champ");
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

/** Suppression du compte : l'adresse e-mail est retapée pour confirmer. */
export const deleteAccountSchema = z.strictObject({ confirmEmail: z.string().trim().min(3).max(254) });
export type DeleteAccountRequest = z.infer<typeof deleteAccountSchema>;

export type ProfileResponse = {
  id: string;
  email: string | null;
  displayName: string | null;
  locale: Locale;
  marketingOptIn: boolean;
  notifyLicenseExpiry: boolean;
  emailVerified: boolean;
  /** Pays du compte : déclaré, ou à défaut déduit de la connexion. */
  countryCode: string | null;
  countrySource: "declared" | "detected" | null;
};

// ---------------------------------------------------------------------
// Catalogue et formules
// ---------------------------------------------------------------------

export type CategoryResponse = { slug: string; name: string; description: string | null };

export type TemplateSummaryResponse = {
  slug: string;
  name: string;
  description: string | null;
  category: CategoryResponse;
  audience: "personal" | "business";
  coverPath: string | null;
  accessTags: string[];
  currentVersion: { version: string; rendererKey: string } | null;
};

export type TemplateDetailResponse = TemplateSummaryResponse & {
  steps: Array<{ id: string; title: string; fields: string[] }>;
  sections: Array<{ id: string; optional: boolean }>;
  maxPhotos: number;
  giftTypes: string[];
  /**
   * Définition de chaque champ (DSL du moteur, `FieldDef` de
   * @zaweli/template-engine/schema) : le web en génère le formulaire de l'assistant.
   */
  fields: Record<string, { kind: string; label: string; help?: string } & Record<string, unknown>>;
};

export type PlanResponse = {
  code: string;
  name: string;
  description: string | null;
  isFree: boolean;
  durationDays: number | null;
  publicationsMax: number | null;
  recipientsMax: number | null;
  aiGenerationsMax: number;
  templateAccess: { mode: "all" } | { mode: "tagged"; tag: string };
  prices: Array<{ currency: string; amount: string }>;
};

// ---------------------------------------------------------------------
// Destinataires
// ---------------------------------------------------------------------

const e164 = z.string().regex(/^\+[1-9][0-9]{6,14}$/, "numéro au format international (+243…)");

export const createRecipientSchema = z.strictObject({
  displayName: trimmed(1, 60),
  contactEmail: z.email().max(254).nullable().optional(),
  contactPhone: e164.nullable().optional(),
  note: trimmed(0, 280).nullable().optional(),
});
export type CreateRecipientRequest = z.infer<typeof createRecipientSchema>;

export const updateRecipientSchema = createRecipientSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "au moins un champ");
export type UpdateRecipientRequest = z.infer<typeof updateRecipientSchema>;

export type RecipientResponse = {
  id: string;
  displayName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  note: string | null;
  /** Licences auxquelles la fiche est liée (règle MULTI-USE) : elle ne peut plus changer de personne. */
  boundLicenseIds: string[];
  createdAt: string;
};

// ---------------------------------------------------------------------
// Expériences
// ---------------------------------------------------------------------

export const EXPERIENCE_STATUSES = ["draft", "published", "disabled", "suspended", "deleted"] as const;
export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number];

export const createExperienceSchema = z.strictObject({
  templateSlug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  recipientId: z.uuid(),
  title: trimmed(1, 80).optional(),
  /** Langue des textes fixes de l'expérience vue par le destinataire. */
  locale: localeSchema.optional(),
});
export type CreateExperienceRequest = z.infer<typeof createExperienceSchema>;

export const updateExperienceSchema = z
  .strictObject({
    title: trimmed(1, 80).nullable().optional(),
    locale: localeSchema.optional(),
    recipientId: z.uuid().optional(),
    /** Contenu complet (remplacement), validé contre le manifeste de la version figée. */
    content: z
      .strictObject({
        fields: z.record(z.string(), z.unknown()),
        disabledSections: z.array(z.string()).default([]),
      })
      .optional(),
    /** Contrôle d'écriture concurrente (deux onglets) : la révision lue. */
    expectedRevision: z.number().int().positive().optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "expectedRevision"), "au moins un champ");
export type UpdateExperienceRequest = z.infer<typeof updateExperienceSchema>;

export const publishExperienceSchema = z.strictObject({
  /** Licence choisie ; à défaut, le serveur prend celle qui expire en premier. */
  licenseId: z.uuid().optional(),
  /** Le droit FREE n'est utilisé que sur choix explicite (cahier des charges §8.4). */
  useFree: z.boolean().optional(),
});
export type PublishExperienceRequest = z.infer<typeof publishExperienceSchema>;

export type ExperienceSummaryResponse = {
  id: string;
  title: string | null;
  status: ExperienceStatus;
  locale: Locale;
  template: { slug: string; name: string; version: string };
  recipient: { id: string; displayName: string };
  slug: string | null;
  contentRevision: number;
  firstPublishedAt: string | null;
  lastPublishedAt: string | null;
  updatedAt: string;
};

export type ExperienceDetailResponse = ExperienceSummaryResponse & {
  content: { fields: Record<string, unknown>; disabledSections: string[] };
  /** Un code est demandé au destinataire (le code lui-même n'est jamais renvoyé). */
  hasAccessCode: boolean;
  /** Le lien ne s'ouvre qu'à partir de cette date (ISO), ou null. */
  availableFrom: string | null;
  /** Musique choisie (référence Audius), ou null. */
  music: MusicChoice | null;
  gifts: GiftResponse[];
  /** Erreurs qui empêchent la publication (vide si tout est prêt). */
  publishIssues: Array<{ path: string; message: string }>;
  /** Le contenu a changé depuis la dernière publication. */
  hasUnpublishedChanges: boolean;
  canEdit: boolean;
};

export type EligibilityResponse = {
  candidates: Array<{
    licenseId: string;
    planCode: string;
    planName: string;
    source: "free" | "purchase" | "admin_grant" | "promotion";
    endsAt: string | null;
    publicationsLeft: number | null;
    requiresExplicitChoice: boolean;
  }>;
  /** Licence retenue par défaut (celle qui expire en premier, hors FREE). */
  defaultLicenseId: string | null;
  /** Raison principale quand aucune licence ne convient. */
  reason: string | null;
};

export type PublishResponse = { slug: string; url: string; revision: number; licenseId: string | null };

/** Nouvelle expérience pour une autre personne, à partir d'une existante (même modèle, même contenu, sans cadeau d'argent). */
export const duplicateExperienceSchema = z.strictObject({ recipientId: z.uuid() });
export type DuplicateExperienceRequest = z.infer<typeof duplicateExperienceSchema>;

/**
 * Réglages d'ouverture et ambiance : code demandé au destinataire, date
 * d'ouverture du lien, musique. null efface ; absent ne change rien.
 */
export const experienceSettingsSchema = z
  .strictObject({
    accessCode: z.string().trim().min(4).max(20).nullable().optional(),
    availableFrom: z.iso.datetime({ offset: true }).nullable().optional(),
    music: musicChoiceSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "au moins un réglage");
export type ExperienceSettingsRequest = z.infer<typeof experienceSettingsSchema>;

/** Code saisi par le destinataire pour ouvrir une expérience protégée. */
export const unlockExperienceSchema = z.strictObject({ code: z.string().trim().min(1).max(40) });
export type UnlockExperienceRequest = z.infer<typeof unlockExperienceSchema>;

// ---------------------------------------------------------------------
// Cadeaux
// ---------------------------------------------------------------------

export const createGiftSchema = z.strictObject({
  type: giftTypeSchema,
  data: z.record(z.string(), z.unknown()),
  protectedData: z.record(z.string(), z.unknown()).optional(),
});
export type CreateGiftRequest = z.infer<typeof createGiftSchema>;

export const updateGiftSchema = z
  .strictObject({
    data: z.record(z.string(), z.unknown()).optional(),
    protectedData: z.record(z.string(), z.unknown()).nullable().optional(),
    position: z.number().int().min(0).max(49).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "au moins un champ");
export type UpdateGiftRequest = z.infer<typeof updateGiftSchema>;

export const giftStatusChangeSchema = z.strictObject({ status: z.string().regex(/^[A-Z][A-Z_]{1,31}$/) });

export type GiftResponse = {
  id: string;
  type: string;
  status: string;
  position: number;
  data: Record<string, unknown>;
  hasProtectedData: boolean;
};

// ---------------------------------------------------------------------
// Licences
// ---------------------------------------------------------------------

export type LicenseResponse = {
  id: string;
  plan: { code: string; name: string };
  source: "free" | "purchase" | "admin_grant" | "promotion";
  status: "pending" | "active" | "expired" | "revoked" | "refunded";
  startsAt: string | null;
  endsAt: string | null;
  publications: { used: number; max: number | null };
  recipients: { bound: Array<{ id: string; displayName: string }>; max: number | null };
  ai: { used: number; max: number };
};

// ---------------------------------------------------------------------
// Signalements et modération
// ---------------------------------------------------------------------

export const REPORT_REASONS = ["harassment", "impersonation", "scam", "hateful", "sexual", "copyright", "privacy", "other"] as const;

export const createReportSchema = z.strictObject({
  reason: z.enum(REPORT_REASONS),
  details: trimmed(0, 1000).optional(),
});
export type CreateReportRequest = z.infer<typeof createReportSchema>;

export const resolveReportSchema = z.strictObject({
  action: z.enum(["dismiss", "suspend"]),
  resolution: trimmed(1, 500).optional(),
});

export const suspendExperienceSchema = z.strictObject({ reason: trimmed(1, 500) });

// ---------------------------------------------------------------------
// Administration (formules, prix, catalogue, licences)
// ---------------------------------------------------------------------

const planCode = z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/);
const tag = z.string().regex(/^[a-z0-9-]{2,40}$/);

/** Champs d'une formule, sans valeur par défaut (la création les ajoute, la modification jamais). */
const planFields = {
  name: trimmed(1, 80),
  description: trimmed(0, 500).nullable(),
  translations: translationsSchema,
  isFree: z.boolean(),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  position: z.number().int(),
  durationDays: z.number().int().positive().nullable(),
  startPolicy: z.enum(["on_payment_confirmed", "on_first_publication", "immediate"]),
  publicationsMax: z.number().int().positive().nullable(),
  recipientsMax: z.number().int().positive().nullable(),
  aiGenerationsMax: z.number().int().min(0),
  templateAccessTag: tag.nullable(),
  editPolicy: z.enum(["while_valid", "days", "never"]),
  editDays: z.number().int().positive().nullable(),
  maxPublicationsPerDay: z.number().int().positive(),
};

export const adminPlanSchema = z.strictObject({
  code: planCode,
  name: planFields.name,
  description: planFields.description.optional(),
  translations: planFields.translations.optional(),
  isFree: planFields.isFree.default(false),
  isActive: planFields.isActive.default(false),
  isPublic: planFields.isPublic.default(false),
  position: planFields.position.default(0),
  durationDays: planFields.durationDays.default(null),
  startPolicy: planFields.startPolicy.default("on_payment_confirmed"),
  publicationsMax: planFields.publicationsMax.default(null),
  recipientsMax: planFields.recipientsMax.default(null),
  aiGenerationsMax: planFields.aiGenerationsMax.default(0),
  templateAccessTag: planFields.templateAccessTag.default(null),
  editPolicy: planFields.editPolicy.default("while_valid"),
  editDays: planFields.editDays.default(null),
  maxPublicationsPerDay: planFields.maxPublicationsPerDay.default(20),
});
export type AdminPlanRequest = z.infer<typeof adminPlanSchema>;

/**
 * Modification partielle d'une formule : un champ absent ne change pas.
 * (Avec `adminPlanSchema.partial()`, Zod donnerait à chaque champ absent sa
 * valeur par défaut : formule désactivée, durée effacée…)
 */
export const adminPlanUpdateSchema = z
  .strictObject(planFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "au moins un champ");

export const adminPriceSchema = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/, "montant décimal, ex. 12.50"),
});

export const adminTemplateUpdateSchema = z
  .strictObject({
    status: z.enum(["draft", "published", "hidden", "retired"]).optional(),
    accessTags: z.array(tag).max(20).optional(),
    translations: translationsSchema.optional(),
    position: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "au moins un champ");

export const adminGrantLicenseSchema = z.strictObject({
  userId: z.uuid(),
  planCode,
  reason: trimmed(1, 300),
});

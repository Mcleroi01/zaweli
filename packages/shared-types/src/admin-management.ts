import { z } from "zod";

/**
 * Écrans de gestion de l'administration (cahier des charges §11.9) :
 * comptes, licences, modèles, modération. Lecture large, écritures
 * journalisées, jamais de contenu des expériences modifié d'ici.
 */
export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["all", "suspended"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export type AdminUserRow = {
  id: string;
  email: string | null;
  displayName: string | null;
  countryCode: string | null;
  createdAt: string;
  suspendedAt: string | null;
  roles: string[];
  experiences: number;
  paidOrders: number;
  activeLicenses: number;
};

export type AdminUserDetail = AdminUserRow & {
  locale: string;
  suspensionReason: string | null;
  deletedAt: string | null;
  referralCode: string | null;
  licenses: Array<{
    id: string;
    plan: string;
    source: string;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    publications: { used: number; max: number | null };
    ai: { used: number; max: number };
  }>;
  orders: Array<{ id: string; plan: string; status: string; amount: string; currency: string; createdAt: string; paidAt: string | null }>;
  experienceList: Array<{ id: string; title: string | null; recipient: string; template: string; status: string; slug: string | null; updatedAt: string }>;
};

export const adminSuspendUserSchema = z.strictObject({ reason: z.string().trim().min(3).max(300) });
export const adminRevokeLicenseSchema = z.strictObject({ reason: z.string().trim().min(3).max(300) });

export type AdminTemplateRow = {
  slug: string;
  name: string;
  status: "draft" | "published" | "hidden" | "retired";
  position: number;
  category: string | null;
  currentVersion: string | null;
  versions: Array<{ version: string; status: string; publishedAt: string | null }>;
  accessTags: string[];
  experiences: number;
  published: number;
};

export type AdminReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: "open" | "dismissed" | "actioned";
  createdAt: string;
  resolution: string | null;
  experience: { id: string; slug: string | null; status: string };
};

export type AdminSuspendedExperienceRow = {
  id: string;
  slug: string | null;
  title: string | null;
  template: string;
  ownerEmail: string | null;
  reason: string | null;
  suspendedAt: string;
};

export type AdminPlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_free: boolean;
  is_active: boolean;
  is_public: boolean;
  position: number;
  duration_days: number | null;
  start_policy: "on_payment_confirmed" | "on_first_publication" | "immediate";
  publications_max: number | null;
  recipients_max: number | null;
  ai_generations_max: number;
  template_access_tag: string | null;
  edit_policy: "while_valid" | "days" | "never";
  edit_days: number | null;
  max_publications_per_day: number;
  prices: Array<{ plan_id: string; currency: string; amount: string; valid_from: string; valid_to: string | null }>;
};

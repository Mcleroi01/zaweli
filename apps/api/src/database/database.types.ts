/**
 * Types Kysely des tables utilisées par l'API.
 *
 * Écrits à la main pour les seules colonnes interrogées ; les migrations SQL
 * (supabase/migrations) restent la source de vérité.
 * Convention : les colonnes JSON sont écrites sous forme de texte JSON
 * (JSON.stringify), ce qui fonctionne à l'identique avec `pg` et PGlite.
 */
import type { ColumnType, Generated } from "kysely";

type Json<T = Record<string, unknown>> = ColumnType<T, string, string>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type CreatedAt = ColumnType<Date, never, never>;
/** numeric(18,2) : lu comme texte (aucune perte de précision), écrit en texte. */
type Numeric = ColumnType<string, string, string>;

export interface AppSettingsTable {
  key: string;
  value: Json<unknown>;
  updated_by: ColumnType<string | null, string | null | undefined, string | null>;
}

export interface AuditLogTable {
  id: Generated<string>;
  occurred_at: CreatedAt;
  actor_type: "user" | "admin" | "system" | "provider" | "anonymous";
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  data: Json;
  request_id: string | null;
  ip_hash: string | null;
}

export interface ProfilesTable {
  id: string;
  display_name: string | null;
  locale: ColumnType<"fr" | "en", "fr" | "en" | undefined, "fr" | "en">;
  marketing_opt_in: ColumnType<boolean, boolean | undefined, boolean>;
  country_code: string | null;
  country_source: "declared" | "detected" | null;
  referral_code: string | null;
  notify_license_expiry: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: CreatedAt;
  deleted_at: Timestamp | null;
}

export interface UserRolesTable {
  user_id: string;
  role: "admin" | "support";
  granted_at: Date;
  granted_by: string | null;
}

export interface TemplateCategoriesTable {
  id: Generated<string>;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  is_active: boolean;
  translations: Json;
}

export type CatalogStatus = "draft" | "published" | "hidden" | "retired";

export interface TemplatesTable {
  id: Generated<string>;
  slug: string;
  name: string;
  description: string | null;
  category_id: string;
  audience: "personal" | "business";
  status: CatalogStatus;
  cover_path: string | null;
  position: number;
  current_version_id: string | null;
  translations: Json;
}

export interface TemplateVersionsTable {
  id: string;
  template_id: string;
  version: string;
  renderer_key: string;
  manifest: Json;
  status: CatalogStatus;
}

export interface TemplateAccessTagsTable {
  template_id: string;
  tag: string;
}

export interface RecipientsTable {
  id: Generated<string>;
  owner_id: string;
  display_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  created_at: CreatedAt;
  deleted_at: Timestamp | null;
}

export type ExperienceStatusDb = "draft" | "published" | "disabled" | "suspended" | "deleted";

export interface ExperiencesTable {
  id: Generated<string>;
  owner_id: string;
  template_id: string;
  template_version_id: string;
  recipient_id: string;
  title: string | null;
  status: ColumnType<ExperienceStatusDb, ExperienceStatusDb | undefined, ExperienceStatusDb>;
  content: Json<{ fields?: Record<string, unknown>; disabledSections?: string[] }>;
  disabled_sections: ColumnType<string[], string[] | undefined, string[]>;
  content_revision: ColumnType<number, number | undefined, number>;
  locale: ColumnType<"fr" | "en", "fr" | "en" | undefined, "fr" | "en">;
  slug: string | null;
  current_snapshot_id: string | null;
  access_code_hash: string | null;
  available_from: Timestamp | null;
  music: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  first_published_at: Timestamp | null;
  last_published_at: Timestamp | null;
  status_changed_at: ColumnType<Date, Date | string | undefined, Date | string>;
  suspension_reason: string | null;
  created_at: CreatedAt;
  updated_at: CreatedAt;
  deleted_at: Timestamp | null;
}

export interface ExperienceSnapshotsTable {
  id: Generated<string>;
  experience_id: string;
  revision: number;
  template_version_id: string;
  public_payload: Json;
  protected_payload: Json;
  created_by: string | null;
}

export type MediaStatus = "pending_upload" | "processing" | "ready" | "rejected" | "deleted";

export interface MediaAssetsTable {
  id: Generated<string>;
  owner_id: string;
  experience_id: string | null;
  field_path: string | null;
  status: ColumnType<MediaStatus, MediaStatus | undefined, MediaStatus>;
  upload_path: string;
  declared_mime: string;
  declared_size_bytes: number;
  detected_mime: string | null;
  width: number | null;
  height: number | null;
  /** Chemins des variantes privées (bucket « media ») : { sm, md, lg }. */
  variants: ColumnType<Record<string, string>, string | undefined, string>;
  published_variants: ColumnType<Record<string, string> | null, string | null | undefined, string | null>;
  rejection_reason: string | null;
  created_at: CreatedAt;
  processed_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface ReportsTable {
  id: Generated<string>;
  experience_id: string;
  reason: string;
  details: string | null;
  reporter_hash: string | null;
  status: ColumnType<"open" | "dismissed" | "actioned", "open" | undefined, "open" | "dismissed" | "actioned">;
  created_at: CreatedAt;
  handled_by: string | null;
  handled_at: Timestamp | null;
  resolution: string | null;
}

export interface GiftTypesTable {
  code: string;
  name: string;
  is_enabled: boolean;
  is_monetary: boolean;
  translations: Json;
}

export interface GiftsTable {
  id: Generated<string>;
  owner_id: string;
  experience_id: string;
  position: number;
  gift_type: string;
  status: string;
  data: Json;
  protected_data: ColumnType<Record<string, unknown>, string | undefined, string>;
  amount: ColumnType<string | null, string | null | undefined, string | null>;
  currency: string | null;
}

export interface PlansTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  audience: ColumnType<"personal" | "business", "personal" | "business" | undefined, "personal" | "business">;
  is_free: boolean;
  is_active: boolean;
  is_public: boolean;
  position: number;
  duration_days: number | null;
  start_policy: "on_payment_confirmed" | "on_first_publication" | "immediate";
  publications_max: number | null;
  recipients_max: number | null;
  ai_generations_max: number;
  template_access_mode: "all" | "tagged";
  template_access_tag: string | null;
  edit_policy: "while_valid" | "days" | "never";
  edit_days: number | null;
  max_publications_per_day: number;
  translations: Json;
}

export interface PlanPricesTable {
  id: Generated<string>;
  plan_id: string;
  currency: string;
  amount: Numeric;
  valid_from: ColumnType<Date, Date | string | undefined, Date | string>;
  valid_to: Timestamp | null;
}

export type LicenseSource = "free" | "purchase" | "admin_grant" | "promotion";
export type LicenseStatus = "pending" | "active" | "expired" | "revoked" | "refunded";

export interface LicensesTable {
  id: Generated<string>;
  user_id: string;
  plan_id: string;
  order_id: string | null;
  source: LicenseSource;
  status: LicenseStatus;
  starts_at: Timestamp | null;
  ends_at: Timestamp | null;
  activated_at: Timestamp | null;
  duration_days: number | null;
  start_policy: PlansTable["start_policy"];
  publications_max: number | null;
  recipients_max: number | null;
  ai_generations_max: number;
  template_access_mode: "all" | "tagged";
  template_access_tag: string | null;
  edit_policy: PlansTable["edit_policy"];
  edit_days: number | null;
  max_publications_per_day: number;
  publications_used: ColumnType<number, number | undefined, number>;
  ai_generations_used: ColumnType<number, number | undefined, number>;
  expiry_reminded_at: Timestamp | null;
  created_at: CreatedAt;
}

export interface LicenseRecipientsTable {
  license_id: string;
  recipient_id: string;
  bound_at: CreatedAt;
  bound_by_experience_id: string | null;
}

export interface LicenseConsumptionsTable {
  id: Generated<string>;
  license_id: string;
  experience_id: string;
  consumed_at: CreatedAt;
}

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "expired" | "refunded" | "disputed";

export interface OrdersTable {
  id: Generated<string>;
  user_id: string;
  kind: ColumnType<"license" | "recipient_extension", "license" | "recipient_extension" | undefined, "license" | "recipient_extension">;
  plan_id: string;
  plan_price_id: string;
  amount: Numeric;
  currency: string;
  status: ColumnType<OrderStatus, OrderStatus | undefined, OrderStatus>;
  idempotency_key: string;
  provider: string;
  country_code: string | null;
  created_at: CreatedAt;
  paid_at: Timestamp | null;
  expires_at: Timestamp | null;
  list_amount: ColumnType<string | null, string | null | undefined, string | null>;
  discount_amount: ColumnType<string, string | undefined, string>;
  credit_amount: ColumnType<string, string | undefined, string>;
}

/** Supabase Auth : lecture seule, pour l'adresse des e-mails transactionnels. */
export interface AuthUsersTable {
  id: string;
  email: string | null;
}

export interface ReferralsTable {
  referee_id: string;
  referrer_id: string;
  created_at: CreatedAt;
  qualified_at: Timestamp | null;
  qualifying_order_id: string | null;
}

export interface GiftCardsTable {
  id: Generated<string>;
  owner_id: string;
  amount: Numeric;
  balance: Numeric;
  currency: string;
  source: "referral" | "admin";
  source_ref: string;
  expires_at: Timestamp | null;
  created_at: CreatedAt;
}

export interface GiftCardMovementsTable {
  id: Generated<string>;
  gift_card_id: string;
  order_id: string | null;
  amount: Numeric;
  kind: "spend" | "release";
  created_at: CreatedAt;
}

export type PaymentStatus = "initiated" | "pending" | "succeeded" | "failed" | "cancelled" | "refunded";

export interface PaymentsTable {
  id: Generated<string>;
  order_id: string;
  provider: string;
  provider_payment_ref: string;
  status: ColumnType<PaymentStatus, PaymentStatus | undefined, PaymentStatus>;
  amount: Numeric;
  currency: string;
  provider_status: string | null;
  fee: ColumnType<string | null, string | null | undefined, string | null>;
  next_action: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  failure_reason: string | null;
  checked_at: Timestamp | null;
  confirmed_at: Timestamp | null;
  created_at: CreatedAt;
}

export interface GiftTransfersTable {
  id: Generated<string>;
  gift_id: string | null;
  owner_id: string;
  direction: "funding" | "payout";
  provider: ColumnType<string, string | undefined, string>;
  provider_ref: string | null;
  status: ColumnType<PaymentStatus, PaymentStatus | undefined, PaymentStatus>;
  amount: Numeric;
  fee: ColumnType<string, string | undefined, string>;
  currency: string;
  country_code: string;
  network: string;
  phone_last4: string;
  next_action: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null>;
  failure_reason: string | null;
  created_at: CreatedAt;
  checked_at: Timestamp | null;
  confirmed_at: Timestamp | null;
}

export interface WebhookEventsTable {
  id: Generated<string>;
  provider: string;
  provider_event_id: string | null;
  event_type: string | null;
  signature_valid: boolean;
  payload: Json;
  received_at: CreatedAt;
  processing_status: ColumnType<"received" | "processed" | "ignored" | "failed", "received" | "processed" | "ignored" | "failed" | undefined, "received" | "processed" | "ignored" | "failed">;
  processed_at: Timestamp | null;
  attempts: ColumnType<number, number | undefined, number>;
  last_error: string | null;
}

export interface ExchangeRatesTable {
  id: Generated<string>;
  currency: string;
  reference_currency: string;
  /** numeric(24,10), lu et écrit en texte. */
  rate: Numeric;
  valid_from: ColumnType<string, string, never>;
  created_by: string | null;
  created_at: CreatedAt;
}

export interface Database {
  "app.app_settings": AppSettingsTable;
  "app.audit_log": AuditLogTable;
  "app.profiles": ProfilesTable;
  "app.user_roles": UserRolesTable;
  "app.template_categories": TemplateCategoriesTable;
  "app.templates": TemplatesTable;
  "app.template_versions": TemplateVersionsTable;
  "app.template_access_tags": TemplateAccessTagsTable;
  "app.recipients": RecipientsTable;
  "app.experiences": ExperiencesTable;
  "app.experience_snapshots": ExperienceSnapshotsTable;
  "app.media_assets": MediaAssetsTable;
  "app.reports": ReportsTable;
  "app.gift_types": GiftTypesTable;
  "app.gifts": GiftsTable;
  "app.plans": PlansTable;
  "app.plan_prices": PlanPricesTable;
  "app.licenses": LicensesTable;
  "app.license_recipients": LicenseRecipientsTable;
  "app.license_consumptions": LicenseConsumptionsTable;
  "app.orders": OrdersTable;
  "app.payments": PaymentsTable;
  "app.gift_transfers": GiftTransfersTable;
  "app.webhook_events": WebhookEventsTable;
  "auth.users": AuthUsersTable;
  "app.referrals": ReferralsTable;
  "app.gift_cards": GiftCardsTable;
  "app.gift_card_movements": GiftCardMovementsTable;
  "app.exchange_rates": ExchangeRatesTable;
}

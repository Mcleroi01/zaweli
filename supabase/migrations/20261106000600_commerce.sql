-- =====================================================================
-- ZAWELI · Migration 0600 — Formules, prix, commandes, paiements,
-- webhooks, licences, consommations, quotas IA.
--
-- Aucune valeur commerciale (prix, durée, quota) n'est fixée ici :
-- tout est paramétrable par l'administration.
--
-- Garde-fous en base (principes P4 et P6) :
--  * une commande ne passe « paid » que si app.actor = 'provider' ;
--  * une licence achetée ne devient « active » que si sa commande est payée ;
--  * une licence COPIE les règles de sa formule à sa création : modifier
--    une formule ne change pas les licences déjà vendues.
-- =====================================================================

create type app.plan_start_policy    as enum ('on_payment_confirmed', 'on_first_publication', 'immediate');
create type app.template_access_mode as enum ('all', 'tagged');
create type app.edit_policy          as enum ('while_valid', 'days', 'never');

-- ---------------------------------------------------------------------
-- Formules
-- ---------------------------------------------------------------------

create table app.plans (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  name                     text not null,
  description              text,
  audience                 app.template_audience not null default 'personal',
  is_free                  boolean not null default false,
  is_active                boolean not null default false,
  is_public                boolean not null default false,
  position                 integer not null default 0,
  duration_days            integer check (duration_days is null or duration_days > 0),
  start_policy             app.plan_start_policy not null default 'on_payment_confirmed',
  publications_max         integer check (publications_max is null or publications_max > 0),
  recipients_max           integer check (recipients_max is null or recipients_max > 0),
  ai_generations_max       integer not null default 0 check (ai_generations_max >= 0),
  template_access_mode     app.template_access_mode not null default 'tagged',
  template_access_tag      text check (template_access_tag is null or template_access_tag ~ '^[a-z0-9-]{2,40}$'),
  edit_policy              app.edit_policy not null default 'while_valid',
  edit_days                integer,
  max_publications_per_day integer not null default 20 check (max_publications_per_day > 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check ((template_access_mode = 'tagged') = (template_access_tag is not null)),
  check ((edit_policy = 'days') = (edit_days is not null and edit_days > 0))
);

-- Une seule formule gratuite.
create unique index plans_single_free_idx on app.plans (is_free) where is_free;

create trigger plans_updated_at
  before update on app.plans
  for each row execute function app.set_updated_at();

create table app.plan_prices (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references app.plans (id) on delete restrict,
  currency   char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount     numeric(18, 2) not null check (amount > 0),
  valid_from timestamptz not null default now(),
  valid_to   timestamptz,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

-- Un seul prix ouvert par formule et par devise.
create unique index plan_prices_open_idx on app.plan_prices (plan_id, currency) where valid_to is null;

-- ---------------------------------------------------------------------
-- Commandes et paiements
-- ---------------------------------------------------------------------

create type app.order_status   as enum ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded', 'disputed');
create type app.order_kind     as enum ('license', 'recipient_extension');
create type app.payment_status as enum ('initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded');

create table app.orders (
  id                uuid primary key default gen_random_uuid(),
  -- RESTRICT : un compte ayant des commandes est anonymisé, pas supprimé
  -- (conservation des pièces comptables).
  user_id           uuid not null references auth.users (id) on delete restrict,
  kind              app.order_kind not null default 'license',
  plan_id           uuid not null references app.plans (id) on delete restrict,
  plan_price_id     uuid not null references app.plan_prices (id) on delete restrict,
  target_license_id uuid,
  quantity          integer not null default 1 check (quantity between 1 and 20),
  -- Montant et devise calculés par le serveur à partir de plan_prices.
  amount            numeric(18, 2) not null check (amount > 0),
  currency          char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status            app.order_status not null default 'pending',
  idempotency_key   text not null check (char_length(idempotency_key) between 8 and 100),
  provider          text not null check (provider ~ '^[a-z0-9_-]{2,30}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  paid_at           timestamptz,
  expires_at        timestamptz,
  unique (user_id, idempotency_key),
  check ((kind = 'recipient_extension') = (target_license_id is not null)),
  check ((status in ('paid', 'refunded', 'disputed')) = (paid_at is not null))
);

create index orders_user_idx   on app.orders (user_id, created_at desc);
create index orders_status_idx on app.orders (status, created_at) where status = 'pending';

create trigger orders_updated_at
  before update on app.orders
  for each row execute function app.set_updated_at();

create table app.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references app.orders (id) on delete restrict,
  provider             text not null,
  provider_payment_ref text not null,
  status               app.payment_status not null default 'initiated',
  amount               numeric(18, 2) not null check (amount > 0),
  currency             char(3) not null check (currency ~ '^[A-Z]{3}$'),
  provider_status      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  confirmed_at         timestamptz,
  unique (provider, provider_payment_ref)
);

create index payments_order_idx on app.payments (order_id);

create trigger payments_updated_at
  before update on app.payments
  for each row execute function app.set_updated_at();

-- Seul le prestataire (webhook vérifié ou rapprochement) confirme un paiement.
create function app.guard_provider_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status::text = any (tg_argv)
     and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and app.current_actor() <> 'provider' then
    raise exception '%_REQUIRES_PROVIDER', upper(tg_table_name) using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orders_paid_requires_provider
  before insert or update on app.orders
  for each row execute function app.guard_provider_confirmation('paid', 'refunded');

create trigger payments_success_requires_provider
  before insert or update on app.payments
  for each row execute function app.guard_provider_confirmation('succeeded', 'refunded');

-- ---------------------------------------------------------------------
-- Webhooks reçus
-- ---------------------------------------------------------------------

create type app.webhook_processing_status as enum ('received', 'processed', 'ignored', 'failed');

create table app.webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text,
  event_type        text,
  signature_valid   boolean not null,
  payload           jsonb not null,
  received_at       timestamptz not null default now(),
  processing_status app.webhook_processing_status not null default 'received',
  processed_at      timestamptz,
  attempts          integer not null default 0 check (attempts >= 0),
  last_error        text,
  check (not signature_valid or provider_event_id is not null)
);

-- Idempotence : un événement AUTHENTIQUE n'est traité qu'une fois.
-- L'unicité ne porte que sur les signatures valides, sinon un faux webhook
-- envoyé en premier pourrait bloquer le vrai.
create unique index webhook_events_unique_valid_idx
  on app.webhook_events (provider, provider_event_id)
  where signature_valid;

create index webhook_events_pending_idx
  on app.webhook_events (received_at)
  where processing_status in ('received', 'failed');

-- ---------------------------------------------------------------------
-- Licences
-- ---------------------------------------------------------------------

create type app.license_status as enum ('pending', 'active', 'expired', 'revoked', 'refunded');
create type app.license_source as enum ('free', 'purchase', 'admin_grant', 'promotion');

create table app.licenses (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  plan_id                  uuid not null references app.plans (id) on delete restrict,
  order_id                 uuid unique references app.orders (id) on delete restrict,
  source                   app.license_source not null,
  status                   app.license_status not null default 'pending',
  starts_at                timestamptz,
  ends_at                  timestamptz,
  -- Règles copiées depuis la formule au moment de la création.
  duration_days            integer check (duration_days is null or duration_days > 0),
  start_policy             app.plan_start_policy not null,
  publications_max         integer check (publications_max is null or publications_max > 0),
  recipients_max           integer check (recipients_max is null or recipients_max > 0),
  ai_generations_max       integer not null default 0 check (ai_generations_max >= 0),
  template_access_mode     app.template_access_mode not null,
  template_access_tag      text,
  edit_policy              app.edit_policy not null,
  edit_days                integer,
  max_publications_per_day integer not null check (max_publications_per_day > 0),
  -- Compteurs.
  publications_used        integer not null default 0 check (publications_used >= 0),
  ai_generations_used      integer not null default 0 check (ai_generations_used >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  activated_at             timestamptz,
  revoked_at               timestamptz,
  revoke_reason            text,
  check (publications_max is null or publications_used <= publications_max),
  check (ai_generations_used <= ai_generations_max),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (status <> 'active' or starts_at is not null or start_policy = 'on_first_publication'),
  check ((source = 'purchase') = (order_id is not null)),
  check ((template_access_mode = 'tagged') = (template_access_tag is not null))
);

-- Décision FREE : une seule licence gratuite par utilisateur, à vie.
create unique index licenses_one_free_per_user_idx on app.licenses (user_id) where source = 'free';
create index licenses_user_status_idx on app.licenses (user_id, status);
create index licenses_expiring_idx    on app.licenses (ends_at) where status = 'active';

create trigger licenses_updated_at
  before update on app.licenses
  for each row execute function app.set_updated_at();

-- Une licence achetée ne peut être active que si sa commande est payée.
create function app.guard_license_activation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active')
     and new.source = 'purchase'
     and not exists (select 1 from app.orders o where o.id = new.order_id and o.status = 'paid') then
    raise exception 'LICENSE_ORDER_NOT_PAID' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger licenses_activation_guard
  before insert or update on app.licenses
  for each row execute function app.guard_license_activation();

alter table app.orders
  add constraint orders_target_license_fk
  foreign key (target_license_id) references app.licenses (id) on delete restrict;

-- Destinataires liés à une licence (règle MULTI-USE).
create table app.license_recipients (
  license_id             uuid not null references app.licenses (id) on delete cascade,
  recipient_id           uuid not null references app.recipients (id) on delete cascade,
  bound_at               timestamptz not null default now(),
  bound_by_experience_id uuid references app.experiences (id) on delete set null,
  primary key (license_id, recipient_id)
);

-- Une ligne = une création consommée (décision C2 : à la première publication).
create table app.license_consumptions (
  id            uuid primary key default gen_random_uuid(),
  license_id    uuid not null references app.licenses (id) on delete cascade,
  experience_id uuid not null unique references app.experiences (id) on delete cascade,
  consumed_at   timestamptz not null default now()
);

create index license_consumptions_window_idx on app.license_consumptions (license_id, consumed_at desc);

-- ---------------------------------------------------------------------
-- Générations IA (quota par licence)
-- ---------------------------------------------------------------------

create type app.ai_generation_status as enum ('reserved', 'succeeded', 'failed', 'released');

create table app.ai_generations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  license_id        uuid not null references app.licenses (id) on delete cascade,
  task              text not null check (task ~ '^[a-z_]{2,40}$'),
  model             text,
  status            app.ai_generation_status not null default 'reserved',
  input_chars       integer check (input_chars >= 0),
  output_chars      integer check (output_chars >= 0),
  prompt_tokens     integer check (prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens >= 0),
  cost_estimate_usd numeric(12, 6) check (cost_estimate_usd >= 0),
  error_code        text,
  created_at        timestamptz not null default now(),
  settled_at        timestamptz,
  check ((status = 'reserved') = (settled_at is null))
);

create index ai_generations_user_idx    on app.ai_generations (user_id, created_at desc);
create index ai_generations_license_idx on app.ai_generations (license_id);

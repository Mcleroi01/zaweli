-- =====================================================================
-- ZAWELI · Migration 1200 — Statistiques mondiales de l'administration
--
--  * Pays du compte (ISO 3166-1 alpha-2) : déclaré par l'utilisateur, ou
--    à défaut déduit de la connexion (en-tête du CDN). La source est gardée.
--  * Pays de chaque commande : figé au moment de l'achat, pour que le
--    chiffre d'affaires par pays ne change pas si le compte déménage.
--  * Taux de change : SAISIS et datés par l'administration, historisés.
--    Ils servent uniquement à additionner des devises différentes dans
--    un total ; les montants d'origine restent la référence comptable.
--  * Le continent n'est pas stocké : il se déduit du pays (shared-types).
-- =====================================================================

alter table app.profiles
  add column country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  add column country_source text check (country_source in ('declared', 'detected')),
  add constraint profiles_country_pair_check check ((country_code is null) = (country_source is null));

alter table app.orders
  add column country_code char(2) check (country_code ~ '^[A-Z]{2}$');

-- Requêtes des statistiques : inscriptions et ventes par jour et par pays.
create index profiles_created_idx      on app.profiles (created_at);
create index profiles_country_idx      on app.profiles (country_code) where country_code is not null;
create index orders_paid_idx           on app.orders (paid_at) where paid_at is not null;
create index experiences_published_idx on app.experiences (first_published_at) where first_published_at is not null;
create index licenses_created_idx      on app.licenses (created_at);
create index audit_log_occurred_idx    on app.audit_log (occurred_at desc);

-- ---------------------------------------------------------------------
-- Taux de change
-- ---------------------------------------------------------------------

create table app.exchange_rates (
  id                 uuid primary key default gen_random_uuid(),
  currency           char(3) not null check (currency ~ '^[A-Z]{3}$'),
  reference_currency char(3) not null check (reference_currency ~ '^[A-Z]{3}$'),
  -- Valeur d'UNE unité de `currency`, exprimée dans `reference_currency`.
  rate               numeric(24, 10) not null check (rate > 0),
  valid_from         date not null,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  check (currency <> reference_currency),
  -- Un seul taux par jour et par paire : en saisir un nouveau ajoute une ligne datée.
  unique (currency, reference_currency, valid_from)
);

create index exchange_rates_lookup_idx on app.exchange_rates (reference_currency, currency, valid_from desc);

comment on table app.exchange_rates is
  'Taux saisis par l''administration. Historique conservé : une saisie ne modifie jamais un taux passé.';

create trigger exchange_rates_append_only
  before update or delete on app.exchange_rates
  for each row execute function app.forbid_mutation('EXCHANGE_RATES_ARE_APPEND_ONLY');

-- Règle de la migration 0800 : RLS sur toute table du schéma app, politique pour l'API seule.
alter table app.exchange_rates enable row level security;
create policy api_full_access on app.exchange_rates for all to zaweli_api using (true) with check (true);
grant select, insert on app.exchange_rates to zaweli_api;
revoke update, delete, truncate on app.exchange_rates from zaweli_api;

insert into app.app_settings (key, value, description) values
  ('finance.reference_currency', '"USD"',
   'Devise dans laquelle l''administration additionne les ventes de toutes les devises (taux de app.exchange_rates).')
on conflict (key) do nothing;

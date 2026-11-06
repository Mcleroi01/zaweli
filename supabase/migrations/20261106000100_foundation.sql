-- =====================================================================
-- ZAWELI · Migration 0100 — Fondation
-- Schéma applicatif privé, rôle de l'API, utilitaires, paramètres, audit.
--
-- Les tables métier vivent dans le schéma `app`, qui N'EST PAS exposé par
-- l'API REST automatique de Supabase (PostgREST n'expose que `public`).
-- Seule l'API NestJS y accède, via le rôle `zaweli_api`.
-- =====================================================================

create schema if not exists app;
comment on schema app is 'ZAWELI : données métier. Accès réservé à l''API (rôle zaweli_api).';

-- Rôle de groupe de l'API. Aucun mot de passe ici : l'utilisateur de connexion
-- est créé hors migration (voir docs/04-modele-de-donnees.md, §8).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'zaweli_api') then
    create role zaweli_api nologin;
  end if;
end
$$;

revoke all on schema app from public;
grant usage on schema app to zaweli_api;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema app from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema app from authenticated';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------

create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bloque toute modification ou suppression (tables en ajout seul).
create function app.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', coalesce(tg_argv[0], 'TABLE_IS_APPEND_ONLY')
    using errcode = 'P0001';
end;
$$;

-- Acteur courant, positionné par l'API en début de transaction :
--   set local app.actor = 'user' | 'admin' | 'system' | 'provider';
--   set local app.actor_id = '<uuid>';
-- Valeur par défaut : 'user' (le moins privilégié).
create function app.current_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.actor', true), ''), 'user');
$$;

create function app.current_actor_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.actor_id', true), '')::uuid;
$$;

-- ---------------------------------------------------------------------
-- Paramètres administrables
-- ---------------------------------------------------------------------

create table app.app_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]{2,80}$'),
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create trigger app_settings_updated_at
  before update on app.app_settings
  for each row execute function app.set_updated_at();

create function app.setting_bool(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select value = 'true'::jsonb from app.app_settings where key = p_key), false);
$$;

-- ---------------------------------------------------------------------
-- Journal d'audit (ajout seul)
-- ---------------------------------------------------------------------

create table app.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('user', 'admin', 'system', 'provider', 'anonymous')),
  actor_id    uuid,
  action      text not null check (action ~ '^[a-z0-9_.]{2,80}$'),
  entity_type text not null check (entity_type ~ '^[a-z0-9_]{2,60}$'),
  entity_id   text,
  data        jsonb not null default '{}'::jsonb,
  request_id  text,
  ip_hash     text
);

create index audit_log_entity_idx on app.audit_log (entity_type, entity_id);
create index audit_log_actor_idx  on app.audit_log (actor_id, occurred_at desc);
create index audit_log_action_idx on app.audit_log (action, occurred_at desc);

create trigger audit_log_append_only
  before update or delete on app.audit_log
  for each row execute function app.forbid_mutation('AUDIT_LOG_IS_APPEND_ONLY');

create trigger audit_log_no_truncate
  before truncate on app.audit_log
  for each statement execute function app.forbid_mutation('AUDIT_LOG_IS_APPEND_ONLY');

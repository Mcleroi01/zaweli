-- =====================================================================
-- ZAWELI · Migration 0300 — Catalogue : catégories, templates, versions,
-- étiquettes d'accès des licences, bibliothèque musicale.
--
-- Rappel (principe P2) : la base décrit des DONNÉES. Le code des renderers
-- reste dans le dépôt ; seule sa clé (`renderer_key`) est stockée ici.
-- =====================================================================

create type app.catalog_status    as enum ('draft', 'published', 'hidden', 'retired');
create type app.template_audience as enum ('personal', 'business');

create table app.template_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger template_categories_updated_at
  before update on app.template_categories
  for each row execute function app.set_updated_at();

create table app.templates (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name               text not null check (char_length(name) between 1 and 80),
  description        text,
  category_id        uuid not null references app.template_categories (id) on delete restrict,
  audience           app.template_audience not null default 'personal',
  status             app.catalog_status not null default 'draft',
  cover_path         text,
  position           integer not null default 0,
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index templates_category_idx on app.templates (category_id) where status = 'published';

create trigger templates_updated_at
  before update on app.templates
  for each row execute function app.set_updated_at();

create table app.template_versions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references app.templates (id) on delete restrict,
  version       text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  renderer_key  text not null unique check (renderer_key ~ '^[a-z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+$'),
  manifest      jsonb not null check (jsonb_typeof(manifest) = 'object'),
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  status        app.catalog_status not null default 'draft',
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (template_id, version),
  unique (id, template_id),
  check (status = 'draft' or published_at is not null)
);

-- La version courante appartient forcément au template.
alter table app.templates
  add constraint templates_current_version_fk
  foreign key (current_version_id, id)
  references app.template_versions (id, template_id)
  deferrable initially deferred;

-- Une version publiée est immuable (manifeste, empreinte, clé, numéro).
-- Seul son statut d'affichage (published → hidden → retired) peut évoluer.
create function app.guard_template_version_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null and (
       new.manifest      is distinct from old.manifest
    or new.manifest_hash is distinct from old.manifest_hash
    or new.renderer_key  is distinct from old.renderer_key
    or new.version       is distinct from old.version
    or new.template_id   is distinct from old.template_id
    or new.published_at  is distinct from old.published_at
  ) then
    raise exception 'TEMPLATE_VERSION_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger template_versions_immutable
  before update on app.template_versions
  for each row execute function app.guard_template_version_immutability();

-- Étiquettes utilisées par les formules (« free-eligible », « solo »…).
create table app.template_access_tags (
  template_id uuid not null references app.templates (id) on delete cascade,
  tag         text not null check (tag ~ '^[a-z0-9-]{2,40}$'),
  primary key (template_id, tag)
);

create index template_access_tags_tag_idx on app.template_access_tags (tag);

-- Bibliothèque musicale sous licence (chaque piste a son justificatif).
create table app.music_tracks (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(title) between 1 and 120),
  artist             text,
  mood               text not null check (mood ~ '^[a-z0-9-]{2,40}$'),
  duration_seconds   integer check (duration_seconds > 0),
  storage_path       text not null unique,
  license_name       text not null,
  license_url        text,
  license_proof_path text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger music_tracks_updated_at
  before update on app.music_tracks
  for each row execute function app.set_updated_at();

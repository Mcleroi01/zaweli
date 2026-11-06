-- =====================================================================
-- ZAWELI · Migration 0400 — Destinataires, expériences, instantanés
-- publiés, médias, tentatives d'énigmes, signalements.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fiches destinataires
-- ---------------------------------------------------------------------

create table app.recipients (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 60),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{6,14}$'),
  note          text check (note is null or char_length(note) <= 280),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (id, owner_id)
);

create index recipients_owner_idx on app.recipients (owner_id) where deleted_at is null;

create trigger recipients_updated_at
  before update on app.recipients
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- Expériences
-- ---------------------------------------------------------------------

create type app.experience_status as enum ('draft', 'published', 'disabled', 'suspended', 'deleted');

create table app.experiences (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  template_id         uuid not null,
  template_version_id uuid not null,
  recipient_id        uuid not null,
  title               text check (title is null or char_length(title) <= 80),
  status              app.experience_status not null default 'draft',
  -- Contenu de travail (brouillon ou révision), validé par l'API contre le manifeste.
  content             jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  disabled_sections   text[] not null default '{}',
  content_revision    integer not null default 1 check (content_revision > 0),
  -- Lien public : attribué à la première publication, jamais réutilisé.
  slug                text unique check (slug ~ '^[A-Za-z0-9]{10,32}$'),
  current_snapshot_id uuid,
  access_code_hash    text,
  available_from      timestamptz,
  first_published_at  timestamptz,
  last_published_at   timestamptz,
  status_changed_at   timestamptz not null default now(),
  suspension_reason   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  -- La version appartient au template choisi.
  foreign key (template_version_id, template_id)
    references app.template_versions (id, template_id) on delete restrict,
  -- Le destinataire appartient au même propriétaire.
  foreign key (recipient_id, owner_id)
    references app.recipients (id, owner_id) on delete restrict,
  unique (id, owner_id),
  unique (id, template_version_id),
  -- Un lien existe si et seulement si l'expérience a déjà été publiée.
  check ((slug is null) = (first_published_at is null)),
  -- Statuts « publics » : un lien est obligatoire.
  check (status not in ('published', 'disabled', 'suspended') or slug is not null)
);

create index experiences_owner_status_idx on app.experiences (owner_id, status);
create index experiences_recipient_idx    on app.experiences (recipient_id);
create index experiences_version_idx      on app.experiences (template_version_id);

create trigger experiences_updated_at
  before update on app.experiences
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- Instantanés publiés (immuables)
-- ---------------------------------------------------------------------

create table app.experience_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  experience_id       uuid not null,
  revision            integer not null check (revision > 0),
  template_version_id uuid not null,
  -- Livré au navigateur du destinataire.
  public_payload      jsonb not null check (jsonb_typeof(public_payload) = 'object'),
  -- JAMAIS livré tel quel : codes de bons, réponses d'énigmes « de valeur »…
  protected_payload   jsonb not null default '{}'::jsonb check (jsonb_typeof(protected_payload) = 'object'),
  created_at          timestamptz not null default now(),
  created_by          uuid,
  unique (experience_id, revision),
  unique (id, experience_id),
  -- L'instantané utilise forcément la version figée de son expérience.
  foreign key (experience_id, template_version_id)
    references app.experiences (id, template_version_id) on delete cascade
);

create trigger experience_snapshots_immutable
  before update on app.experience_snapshots
  for each row execute function app.forbid_mutation('SNAPSHOT_IS_IMMUTABLE');

alter table app.experiences
  add constraint experiences_current_snapshot_fk
  foreign key (current_snapshot_id, id)
  references app.experience_snapshots (id, experience_id)
  deferrable initially deferred;

-- ---------------------------------------------------------------------
-- Médias
-- ---------------------------------------------------------------------

create type app.media_status as enum ('pending_upload', 'processing', 'ready', 'rejected', 'deleted');

create table app.media_assets (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  experience_id       uuid,
  field_path          text check (field_path is null or char_length(field_path) <= 120),
  kind                text not null default 'photo' check (kind in ('photo')),
  status              app.media_status not null default 'pending_upload',
  upload_path         text not null unique,
  declared_mime       text not null,
  declared_size_bytes integer not null check (declared_size_bytes > 0 and declared_size_bytes <= 26214400),
  detected_mime       text,
  width               integer check (width > 0),
  height              integer check (height > 0),
  variants            jsonb not null default '{}'::jsonb,
  published_variants  jsonb,
  rejection_reason    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  processed_at        timestamptz,
  deleted_at          timestamptz,
  foreign key (experience_id, owner_id)
    references app.experiences (id, owner_id) on delete cascade,
  check (status <> 'ready' or (detected_mime is not null and width is not null and height is not null))
);

create index media_assets_owner_status_idx on app.media_assets (owner_id, status);
create index media_assets_experience_idx   on app.media_assets (experience_id);

create trigger media_assets_updated_at
  before update on app.media_assets
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- Tentatives d'énigmes protégées (limitation de débit côté serveur)
-- ---------------------------------------------------------------------

create table app.riddle_attempts (
  id            bigint generated always as identity primary key,
  experience_id uuid not null references app.experiences (id) on delete cascade,
  riddle_key    text not null check (char_length(riddle_key) <= 60),
  client_hash   text not null,
  success       boolean not null,
  attempted_at  timestamptz not null default now()
);

create index riddle_attempts_window_idx
  on app.riddle_attempts (experience_id, riddle_key, client_hash, attempted_at desc);

-- ---------------------------------------------------------------------
-- Signalements
-- ---------------------------------------------------------------------

create type app.report_status as enum ('open', 'dismissed', 'actioned');

create table app.reports (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references app.experiences (id) on delete cascade,
  reason        text not null check (reason in
                  ('harassment', 'impersonation', 'scam', 'hateful', 'sexual', 'copyright', 'privacy', 'other')),
  details       text check (details is null or char_length(details) <= 1000),
  reporter_hash text,
  status        app.report_status not null default 'open',
  created_at    timestamptz not null default now(),
  handled_by    uuid references auth.users (id) on delete set null,
  handled_at    timestamptz,
  resolution    text,
  check ((status = 'open') = (handled_at is null))
);

create index reports_status_idx on app.reports (status, created_at);

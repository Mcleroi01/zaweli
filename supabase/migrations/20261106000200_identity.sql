-- =====================================================================
-- ZAWELI · Migration 0200 — Identité : profils et rôles applicatifs
-- L'authentification est gérée par Supabase Auth (auth.users).
-- =====================================================================

create table app.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text check (char_length(display_name) <= 80),
  locale           text not null default 'fr' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create trigger profiles_updated_at
  before update on app.profiles
  for each row execute function app.set_updated_at();

-- Rôles applicatifs. Ils ne sont jamais lus depuis le JWT envoyé par le client.
create type app.app_role as enum ('admin', 'support');

create table app.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       app.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

-- Création automatique du profil à l'inscription.
create function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app.handle_new_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

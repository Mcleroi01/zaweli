-- =====================================================================
-- ZAWELI · Migration 0500 — Système universel de cadeaux
--
-- Extensible sans migration de schéma : un nouveau type de cadeau =
-- de nouvelles LIGNES dans gift_types / gift_type_statuses /
-- gift_status_transitions (le formulaire et le rendu vivent dans le code).
--
-- Garde-fous en base (principe P6) :
--  * un statut « confirmé par le prestataire » ne peut être posé que
--    dans une transaction où app.actor = 'provider' ;
--  * tant que le paramètre gifts.money_transfers_enabled est faux, un
--    cadeau monétaire ne peut être qu'ANNOUNCED ou CANCELLED (décision C1).
-- =====================================================================

create table app.gift_types (
  code        text primary key check (code ~ '^[A-Z][A-Z_]{1,31}$'),
  name        text not null,
  is_enabled  boolean not null default true,
  is_monetary boolean not null default false,
  created_at  timestamptz not null default now()
);

create table app.gift_type_statuses (
  gift_type                      text not null references app.gift_types (code) on delete cascade,
  status                         text not null check (status ~ '^[A-Z][A-Z_]{1,31}$'),
  is_initial                     boolean not null default false,
  is_terminal                    boolean not null default false,
  requires_provider_confirmation boolean not null default false,
  primary key (gift_type, status)
);

create table app.gift_status_transitions (
  gift_type     text not null,
  from_status   text not null,
  to_status     text not null,
  allowed_actor text not null check (allowed_actor in ('user', 'admin', 'system', 'provider')),
  primary key (gift_type, from_status, to_status, allowed_actor),
  foreign key (gift_type, from_status) references app.gift_type_statuses (gift_type, status) on delete cascade,
  foreign key (gift_type, to_status)   references app.gift_type_statuses (gift_type, status) on delete cascade,
  check (from_status <> to_status)
);

create table app.gifts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null,
  experience_id     uuid not null,
  position          smallint not null check (position between 0 and 49),
  gift_type         text not null references app.gift_types (code) on delete restrict,
  status            text not null,
  -- Champs saisis, validés par l'API contre le schéma du type.
  data              jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  -- Champs livrés seulement au déballage (ex. code d'un bon).
  protected_data    jsonb not null default '{}'::jsonb check (jsonb_typeof(protected_data) = 'object'),
  amount            numeric(18, 2) check (amount is null or amount > 0),
  currency          char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (experience_id, owner_id)
    references app.experiences (id, owner_id) on delete cascade,
  foreign key (gift_type, status)
    references app.gift_type_statuses (gift_type, status),
  unique (experience_id, position),
  check ((amount is null) = (currency is null))
);

create index gifts_owner_idx on app.gifts (owner_id, status);

create trigger gifts_updated_at
  before update on app.gifts
  for each row execute function app.set_updated_at();

create table app.gift_status_history (
  id          bigint generated always as identity primary key,
  gift_id     uuid not null references app.gifts (id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor       text not null,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);

create index gift_status_history_gift_idx on app.gift_status_history (gift_id, created_at);

create trigger gift_status_history_append_only
  before update on app.gift_status_history
  for each row execute function app.forbid_mutation('GIFT_HISTORY_IS_APPEND_ONLY');

-- ---------------------------------------------------------------------
-- Règles de statut
-- ---------------------------------------------------------------------

create function app.guard_gift()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type   app.gift_types;
  v_status app.gift_type_statuses;
  v_actor  text := app.current_actor();
begin
  select * into v_type from app.gift_types where code = new.gift_type;
  select * into v_status from app.gift_type_statuses
   where gift_type = new.gift_type and status = new.status;

  if tg_op = 'INSERT' then
    if not v_type.is_enabled then
      raise exception 'GIFT_TYPE_DISABLED' using errcode = 'P0001';
    end if;
    if not v_status.is_initial then
      raise exception 'GIFT_INVALID_INITIAL_STATUS' using errcode = 'P0001';
    end if;
  elsif new.gift_type is distinct from old.gift_type then
    raise exception 'GIFT_TYPE_IMMUTABLE' using errcode = 'P0001';
  elsif new.status is distinct from old.status then
    if not exists (
      select 1 from app.gift_status_transitions t
       where t.gift_type = new.gift_type
         and t.from_status = old.status
         and t.to_status = new.status
         and t.allowed_actor = v_actor
    ) then
      raise exception 'GIFT_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if v_status.requires_provider_confirmation and v_actor <> 'provider' then
      raise exception 'GIFT_STATUS_REQUIRES_PROVIDER' using errcode = 'P0001';
    end if;
    new.status_changed_at := now();
  end if;

  if v_type.is_monetary then
    if new.amount is null then
      raise exception 'GIFT_MONEY_REQUIRES_AMOUNT' using errcode = 'P0001';
    end if;
    if new.status not in ('ANNOUNCED', 'CANCELLED')
       and not app.setting_bool('gifts.money_transfers_enabled') then
      raise exception 'MONEY_TRANSFERS_DISABLED' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger gifts_guard
  before insert or update on app.gifts
  for each row execute function app.guard_gift();

create function app.log_gift_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into app.gift_status_history (gift_id, from_status, to_status, actor, actor_id)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      app.current_actor(),
      app.current_actor_id()
    );
  end if;
  return null;
end;
$$;

create trigger gifts_status_history
  after insert or update on app.gifts
  for each row execute function app.log_gift_status();

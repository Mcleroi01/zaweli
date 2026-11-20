-- =====================================================================
-- ZAWELI · Migration — Paiements mobile money (MbiyoPay, docs/12)
--
--  * app.payments garde ce que le réseau a répondu : frais, étape à
--    suivre (USSD, page Wave, code), motif d'échec ;
--  * app.gift_transfers : l'argent d'un cadeau, dans les deux sens —
--    « funding » (l'expéditeur paie) et « payout » (le destinataire reçoit) ;
--  * le réglage payments.money_fee_rate fixe ce que l'expéditeur paie en
--    plus du montant offert (frais de collecte et d'envoi). Tant qu'il est
--    vide, aucun cadeau d'argent ne peut être payé : rien n'est inventé.
--
-- Garde-fou inchangé : seul l'acteur « provider » (réponse vérifiée du
-- prestataire) peut poser « succeeded » ou « refunded ».
-- =====================================================================

alter table app.payments
  add column fee            numeric(18, 2) check (fee is null or fee >= 0),
  add column next_action    jsonb check (next_action is null or jsonb_typeof(next_action) = 'object'),
  add column failure_reason text check (failure_reason is null or char_length(failure_reason) <= 300),
  add column checked_at     timestamptz;

create type app.gift_transfer_direction as enum ('funding', 'payout');

create table app.gift_transfers (
  id             uuid primary key default gen_random_uuid(),
  -- SET NULL : la trace financière survit au cadeau (l'API refuse de
  -- supprimer un cadeau payé ; seuls les essais échoués perdent leur lien).
  gift_id        uuid references app.gifts (id) on delete set null,
  owner_id       uuid not null references auth.users (id) on delete restrict,
  direction      app.gift_transfer_direction not null,
  provider       text not null default 'mbiyopay' check (provider ~ '^[a-z0-9_-]{2,30}$'),
  -- Identifiant du prestataire, connu après l'envoi de la demande.
  provider_ref   text,
  status         app.payment_status not null default 'initiated',
  -- funding : ce que l'expéditeur paie (montant offert + frais) ;
  -- payout : ce que le destinataire reçoit (le montant offert).
  amount         numeric(18, 2) not null check (amount > 0),
  -- funding : frais facturés à l'expéditeur ; payout : frais du prestataire.
  fee            numeric(18, 2) not null default 0 check (fee >= 0),
  currency       char(3) not null check (currency ~ '^[A-Z]{3}$'),
  country_code   char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  network        text not null check (network ~ '^[a-z0-9]{2,20}$'),
  -- Le numéro complet ne sert qu'à l'appel au prestataire : on n'en garde
  -- que la fin, pour l'assistance.
  phone_last4    text not null check (phone_last4 ~ '^\d{4}$'),
  next_action    jsonb check (next_action is null or jsonb_typeof(next_action) = 'object'),
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  checked_at     timestamptz,
  confirmed_at   timestamptz,
  unique (provider, provider_ref)
);

create index gift_transfers_gift_idx on app.gift_transfers (gift_id, created_at desc);
create index gift_transfers_pending_idx on app.gift_transfers (created_at) where status in ('initiated', 'pending');

create trigger gift_transfers_updated_at
  before update on app.gift_transfers
  for each row execute function app.set_updated_at();

create trigger gift_transfers_success_requires_provider
  before insert or update on app.gift_transfers
  for each row execute function app.guard_provider_confirmation('succeeded', 'refunded');

-- Un seul transfert en cours par cadeau et par sens : pas de double paiement.
create unique index gift_transfers_one_open_idx
  on app.gift_transfers (gift_id, direction)
  where status in ('initiated', 'pending');

alter table app.gift_transfers enable row level security;
create policy api_full_access on app.gift_transfers for all to zaweli_api using (true) with check (true);
grant select, insert, update on app.gift_transfers to zaweli_api;
revoke delete, truncate on app.gift_transfers from zaweli_api;

-- ---------------------------------------------------------------------
-- Cadeau d'argent : passer d'une promesse à un transfert (et revenir
-- en arrière) tant que rien n'est payé.
-- ---------------------------------------------------------------------

insert into app.gift_status_transitions (gift_type, from_status, to_status, allowed_actor) values
  ('MONEY', 'ANNOUNCED',        'AWAITING_FUNDING', 'user'),
  ('MONEY', 'AWAITING_FUNDING', 'ANNOUNCED',        'user')
on conflict do nothing;

insert into app.app_settings (key, value, description) values
  ('payments.money_fee_rate', 'null',
   'Part ajoutée au montant d''un cadeau d''argent pour couvrir les frais de collecte et d''envoi (ex. "0.035" = 3,5 %). Vide : paiement des cadeaux d''argent impossible.')
on conflict (key) do nothing;

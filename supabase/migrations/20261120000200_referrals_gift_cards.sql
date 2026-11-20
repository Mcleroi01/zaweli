-- =====================================================================
-- ZAWELI · Migration — Parrainage et cartes cadeaux (docs/13)
--
--  * Chaque compte a un code de parrainage (profiles.referral_code).
--  * app.referrals : un filleul n'a qu'un parrain ; le parrainage devient
--    « qualifié » au PREMIER ACHAT payé du filleul (jamais à l'inscription).
--  * Paliers (réglage referrals.reward_tiers) : au Nᵉ filleul qualifié, le
--    parrain reçoit une carte cadeau, une seule fois par palier.
--  * Le filleul peut bénéficier d'une réduction sur son premier achat
--    (réglage referrals.referee_discount_rate, vide = aucune).
--  * app.gift_cards / app.gift_card_movements : solde dépensé à l'achat
--    d'une formule ; chaque mouvement est tracé, le solde ne passe jamais
--    sous zéro.
--  * Une commande entièrement couverte par une carte cadeau ne passe par
--    aucun prestataire : app.settle_credit_order la marque payée après
--    avoir vérifié que la carte couvre bien tout.
-- =====================================================================

alter table app.profiles add column referral_code text unique check (referral_code ~ '^[A-HJ-NP-Z2-9]{8}$');

create table app.referrals (
  referee_id          uuid primary key references auth.users (id) on delete cascade,
  referrer_id         uuid not null references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  qualified_at        timestamptz,
  qualifying_order_id uuid references app.orders (id) on delete set null,
  check (referee_id <> referrer_id)
);

create index referrals_referrer_idx on app.referrals (referrer_id, qualified_at);

alter table app.referrals enable row level security;
create policy api_full_access on app.referrals for all to zaweli_api using (true) with check (true);
grant select, insert, update on app.referrals to zaweli_api;
revoke delete, truncate on app.referrals from zaweli_api;

-- ---------------------------------------------------------------------
-- Cartes cadeaux
-- ---------------------------------------------------------------------

create table app.gift_cards (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  amount     numeric(18, 2) not null check (amount > 0),
  balance    numeric(18, 2) not null check (balance >= 0),
  currency   char(3) not null check (currency ~ '^[A-Z]{3}$'),
  source     text not null check (source in ('referral', 'admin')),
  -- Ex. « referral:25 » : un palier n'est accordé qu'une fois.
  source_ref text not null check (char_length(source_ref) between 2 and 80),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_ref),
  check (balance <= amount)
);

create index gift_cards_owner_idx on app.gift_cards (owner_id, currency) where balance > 0;

create trigger gift_cards_updated_at
  before update on app.gift_cards
  for each row execute function app.set_updated_at();

create table app.gift_card_movements (
  id           bigint generated always as identity primary key,
  gift_card_id uuid not null references app.gift_cards (id) on delete cascade,
  order_id     uuid references app.orders (id) on delete set null,
  -- Négatif : dépense (réservée à la création de la commande) ; positif : remise (paiement échoué).
  amount       numeric(18, 2) not null check (amount <> 0),
  kind         text not null check (kind in ('spend', 'release')),
  created_at   timestamptz not null default now()
);

create index gift_card_movements_order_idx on app.gift_card_movements (order_id);

create trigger gift_card_movements_append_only
  before update on app.gift_card_movements
  for each row execute function app.forbid_mutation('GIFT_CARD_MOVEMENTS_ARE_APPEND_ONLY');

alter table app.gift_cards enable row level security;
create policy api_full_access on app.gift_cards for all to zaweli_api using (true) with check (true);
grant select, insert, update on app.gift_cards to zaweli_api;
revoke delete, truncate on app.gift_cards from zaweli_api;

alter table app.gift_card_movements enable row level security;
create policy api_full_access on app.gift_card_movements for all to zaweli_api using (true) with check (true);
grant select, insert on app.gift_card_movements to zaweli_api;
revoke update, delete, truncate on app.gift_card_movements from zaweli_api;

-- ---------------------------------------------------------------------
-- Commandes : prix catalogue, réduction, carte cadeau, reste à payer
-- ---------------------------------------------------------------------

alter table app.orders drop constraint orders_amount_check;
alter table app.orders
  -- amount = ce qui passe par le prestataire (0 si la carte cadeau couvre tout).
  add constraint orders_amount_check check (amount >= 0),
  add column list_amount     numeric(18, 2) check (list_amount is null or list_amount > 0),
  add column discount_amount numeric(18, 2) not null default 0 check (discount_amount >= 0),
  add column credit_amount   numeric(18, 2) not null default 0 check (credit_amount >= 0),
  add constraint orders_breakdown_check check (list_amount is null or amount + discount_amount + credit_amount = list_amount);

/**
 * Commande entièrement réglée par carte cadeau : aucune transaction chez un
 * prestataire, donc c'est la base elle-même qui vérifie la couverture
 * (montant à payer nul, dépense de carte égale au crédit annoncé) avant de
 * poser « payée » et d'activer la licence.
 */
create function app.settle_credit_order(p_order_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_order app.orders;
  v_spent numeric(18, 2);
begin
  select * into v_order from app.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_order.status <> 'pending' or v_order.amount <> 0 or v_order.credit_amount <= 0 then
    raise exception 'ORDER_NOT_CREDIT_COVERED' using errcode = 'P0001';
  end if;
  select coalesce(-sum(amount), 0) into v_spent from app.gift_card_movements where order_id = p_order_id;
  if v_spent <> v_order.credit_amount then
    raise exception 'ORDER_NOT_CREDIT_COVERED' using errcode = 'P0001';
  end if;
  perform set_config('app.actor', 'provider', true);
  update app.orders set status = 'paid', paid_at = now() where id = p_order_id;
  return app.activate_purchase_license(p_order_id);
end;
$$;

revoke all on function app.settle_credit_order(uuid) from public;
grant execute on function app.settle_credit_order(uuid) to zaweli_api;

insert into app.app_settings (key, value, description) values
  ('referrals.reward_tiers', '[{"threshold": 25, "amount": "5.00", "currency": "USD"}, {"threshold": 50, "amount": "10.00", "currency": "USD"}]',
   'Paliers du parrainage : au Nᵉ filleul ayant payé sa première formule, le parrain reçoit une carte cadeau (une fois par palier).'),
  ('referrals.referee_discount_rate', 'null',
   'Réduction du filleul sur sa première formule (ex. "0.20" = 20 %). Vide : aucune réduction.')
on conflict (key) do nothing;

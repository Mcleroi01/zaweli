-- =====================================================================
-- ZAWELI · Migration 1000 — Données de référence (tous environnements)
-- Déplacées depuis seed/ : `supabase db push` n'exécute pas les seeds,
-- or ces lignes sont nécessaires en production.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------

insert into app.app_settings (key, value, description) values
  ('gifts.money_transfers_enabled', 'false',
   'Décision C1 : pas de transfert d''argent réel au MVP. Un cadeau MONEY ne peut être qu''annoncé.'),
  ('drafts.max_active', '5',
   'Nombre maximum de brouillons actifs par compte (recommandation C18, à valider).')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Catégories de templates
-- ---------------------------------------------------------------------

insert into app.template_categories (slug, name, position) values
  ('anniversaire',  'Anniversaire',  10),
  ('amour',         'Amour',         20),
  ('felicitations', 'Félicitations', 30),
  ('remerciements', 'Remerciements', 40),
  ('invitation',    'Invitation',    50),
  ('surprise',      'Surprise',      60)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Types de cadeaux, statuts et transitions (cahier des charges §9)
-- ---------------------------------------------------------------------

insert into app.gift_types (code, name, is_monetary) values
  ('MONEY',      'Cadeau financier', true),
  ('PHYSICAL',   'Cadeau physique',  false),
  ('INVITATION', 'Invitation',       false),
  ('VOUCHER',    'Bon cadeau',       false),
  ('EXPERIENCE', 'Expérience',       false)
on conflict (code) do nothing;

insert into app.gift_type_statuses (gift_type, status, is_initial, is_terminal, requires_provider_confirmation) values
  -- MONEY : seul ANNOUNCED/CANCELLED est utilisable tant que
  -- gifts.money_transfers_enabled = false (garde-fou en base).
  ('MONEY', 'ANNOUNCED',        true,  false, false),
  ('MONEY', 'AWAITING_FUNDING', true,  false, false),
  ('MONEY', 'FUNDED',           false, false, true),
  ('MONEY', 'AWAITING_CLAIM',   false, false, false),
  ('MONEY', 'TRANSFER_PENDING', false, false, false),
  ('MONEY', 'TRANSFERRED',      false, true,  true),
  ('MONEY', 'FAILED',           false, false, false),
  ('MONEY', 'REFUNDED',         false, true,  true),
  ('MONEY', 'CANCELLED',        false, true,  false),

  ('PHYSICAL', 'ANNOUNCED',   true,  false, false),
  ('PHYSICAL', 'HANDED_OVER', false, true,  false),
  ('PHYSICAL', 'CANCELLED',   false, true,  false),

  ('INVITATION', 'ANNOUNCED', true,  false, false),
  ('INVITATION', 'PAST',      false, true,  false),
  ('INVITATION', 'CANCELLED', false, true,  false),

  ('VOUCHER', 'ANNOUNCED', true,  false, false),
  ('VOUCHER', 'CANCELLED', false, true,  false),

  ('EXPERIENCE', 'ANNOUNCED', true,  false, false),
  ('EXPERIENCE', 'CANCELLED', false, true,  false)
on conflict (gift_type, status) do nothing;

insert into app.gift_status_transitions (gift_type, from_status, to_status, allowed_actor) values
  ('MONEY', 'ANNOUNCED',        'CANCELLED',        'user'),
  ('MONEY', 'AWAITING_FUNDING', 'CANCELLED',        'user'),
  ('MONEY', 'AWAITING_FUNDING', 'FUNDED',           'provider'),
  ('MONEY', 'FUNDED',           'AWAITING_CLAIM',   'system'),
  ('MONEY', 'AWAITING_CLAIM',   'TRANSFER_PENDING', 'system'),
  ('MONEY', 'TRANSFER_PENDING', 'TRANSFERRED',      'provider'),
  ('MONEY', 'TRANSFER_PENDING', 'FAILED',           'provider'),
  ('MONEY', 'FAILED',           'TRANSFER_PENDING', 'system'),
  ('MONEY', 'FUNDED',           'REFUNDED',         'provider'),
  ('MONEY', 'FAILED',           'REFUNDED',         'provider'),

  ('PHYSICAL', 'ANNOUNCED', 'HANDED_OVER', 'user'),
  ('PHYSICAL', 'ANNOUNCED', 'CANCELLED',   'user'),

  ('INVITATION', 'ANNOUNCED', 'CANCELLED', 'user'),
  ('INVITATION', 'ANNOUNCED', 'PAST',      'system'),

  ('VOUCHER', 'ANNOUNCED', 'CANCELLED', 'user'),

  ('EXPERIENCE', 'ANNOUNCED', 'CANCELLED', 'user')
on conflict do nothing;

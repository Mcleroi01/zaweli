-- =====================================================================
-- ZAWELI · Migration 1100 — Deux langues (français, anglais)
--
--  * Textes du catalogue traduisibles : colonne `translations` (JSON)
--    { "en": { "name": "…", "description": "…" } }. La colonne d'origine,
--    rédigée en français, reste la valeur de repli.
--  * Langue d'une expérience : celle des textes FIXES du template vus par
--    le destinataire (« Je t'offre » / « I'm giving you »). Le contenu
--    saisi par l'expéditeur reste dans sa langue à lui.
--  * Langue du profil limitée aux langues prises en charge.
--  * Vérification de l'e-mail lisible par l'API (droit FREE réservé aux
--    comptes vérifiés, cahier des charges §8.3) sans lui ouvrir auth.users.
-- =====================================================================

alter table app.template_categories
  add column translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');
alter table app.templates
  add column translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');
alter table app.plans
  add column translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');
alter table app.gift_types
  add column translations jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object');

alter table app.experiences
  add column locale text not null default 'fr' check (locale in ('fr', 'en'));

update app.profiles set locale = 'fr' where locale not in ('fr', 'en');
alter table app.profiles drop constraint if exists profiles_locale_check;
alter table app.profiles add constraint profiles_locale_check check (locale in ('fr', 'en'));

-- ---------------------------------------------------------------------
-- Traductions anglaises des données de référence
-- ---------------------------------------------------------------------

update app.template_categories c
   set translations = jsonb_build_object('en', jsonb_build_object('name', t.name))
  from (values
    ('anniversaire',  'Birthday'),
    ('amour',         'Love'),
    ('felicitations', 'Congratulations'),
    ('remerciements', 'Thank you'),
    ('invitation',    'Invitation'),
    ('surprise',      'Surprise')
  ) as t (slug, name)
 where c.slug = t.slug and c.translations = '{}'::jsonb;

update app.gift_types g
   set translations = jsonb_build_object('en', jsonb_build_object('name', t.name))
  from (values
    ('MONEY',      'Money gift'),
    ('PHYSICAL',   'Physical gift'),
    ('INVITATION', 'Invitation'),
    ('VOUCHER',    'Gift voucher'),
    ('EXPERIENCE', 'Experience')
  ) as t (code, name)
 where g.code = t.code and g.translations = '{}'::jsonb;

insert into app.app_settings (key, value, description) values
  ('i18n.locales', '["fr", "en"]', 'Langues proposées. Le français est la langue par défaut.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- E-mail vérifié (lecture seule, une seule colonne)
-- ---------------------------------------------------------------------

create function app.is_email_confirmed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.email_confirmed_at is not null from auth.users u where u.id = p_user_id), false);
$$;

revoke all on function app.is_email_confirmed(uuid) from public;
grant execute on function app.is_email_confirmed(uuid) to zaweli_api;

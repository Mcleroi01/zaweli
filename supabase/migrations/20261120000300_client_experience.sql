-- =====================================================================
-- ZAWELI · Migration — Finitions de l'expérience client (docs/15)
--
--  * Préférence « rappel avant l'expiration d'une licence » (e-mail),
--    et trace du rappel envoyé (une seule fois par licence).
--  * Musique choisie pour une expérience (référence Audius, docs/12 §6) :
--    portée par l'expérience, pas par le manifeste, donc disponible pour
--    tous les modèles sans nouvelle version.
--  * Comptes supprimés : anonymisés quand des pièces comptables existent.
-- =====================================================================

alter table app.profiles
  add column notify_license_expiry boolean not null default true;

alter table app.licenses
  add column expiry_reminded_at timestamptz;

alter table app.experiences
  add column music jsonb check (music is null or (jsonb_typeof(music) = 'object' and music ->> 'source' = 'audius'));

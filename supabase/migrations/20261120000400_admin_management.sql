-- =====================================================================
-- ZAWELI · Migration — Écrans de gestion de l'administration (docs/16)
--
-- Suspension d'un compte par l'administration : l'API refuse ses jetons
-- (même encore valides) et Supabase Auth bloque la connexion. Le motif est
-- gardé pour l'équipe, jamais montré au public.
-- =====================================================================

alter table app.profiles
  add column suspended_at      timestamptz,
  add column suspension_reason text check (suspension_reason is null or char_length(suspension_reason) between 1 and 300),
  add constraint profiles_suspension_check check ((suspended_at is null) = (suspension_reason is null));

create index profiles_suspended_idx on app.profiles (suspended_at) where suspended_at is not null;

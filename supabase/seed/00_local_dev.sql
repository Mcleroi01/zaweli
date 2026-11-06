-- =====================================================================
-- ZAWELI · Seed de DÉVELOPPEMENT LOCAL uniquement
--
-- Exécuté par `supabase db reset` sur la base locale (Docker).
-- JAMAIS en staging ni en production : `supabase db push` n'exécute pas
-- les seeds.
-- =====================================================================

-- Utilisateur de connexion de l'API, membre du rôle zaweli_api.
-- Mot de passe CONNU et public : il n'est valable que sur la base locale.
-- En staging et production, ce rôle est créé à la main avec un secret
-- (docs/04-modele-de-donnees.md, §8).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'zaweli_api_login') then
    create role zaweli_api_login login password 'zaweli_local_dev_only' in role zaweli_api;
  end if;
end
$$;

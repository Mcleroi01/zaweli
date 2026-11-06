-- =====================================================================
-- ZAWELI · Migration 0800 — Sécurité : RLS et privilèges
--
-- Stratégie (architecture A7) :
--  * RLS activée sur TOUTES les tables du schéma app ;
--  * aucune politique pour anon / authenticated : le navigateur ne peut
--    rien lire ni écrire directement, même avec un jeton valide ;
--  * une politique explicite pour le rôle de l'API (zaweli_api) ;
--  * tables en ajout seul : UPDATE / DELETE retirés à l'API.
--
-- RÈGLE POUR LES MIGRATIONS FUTURES : toute nouvelle table du schéma app
-- doit activer la RLS et créer sa politique api_full_access. Le test
-- « every_app_table_has_rls » (docs/04-modele-de-donnees.md, §9) le vérifie.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', r.tablename);
    execute format(
      'create policy api_full_access on app.%I for all to zaweli_api using (true) with check (true)',
      r.tablename
    );
  end loop;
end
$$;

grant select, insert, update, delete on all tables in schema app to zaweli_api;
grant usage, select on all sequences in schema app to zaweli_api;

-- Tables en ajout seul (doublé par les déclencheurs).
revoke update, delete, truncate on app.audit_log            from zaweli_api;
revoke update, delete, truncate on app.gift_status_history  from zaweli_api;
revoke update, delete, truncate on app.experience_snapshots from zaweli_api;

-- Fonctions : exécution réservée à l'API.
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to zaweli_api;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema app from anon';
    execute 'revoke all on all functions in schema app from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema app from authenticated';
    execute 'revoke all on all functions in schema app from authenticated';
  end if;
end
$$;

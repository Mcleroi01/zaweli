-- =====================================================================
-- ZAWELI · Migration — Pays à l'inscription, purge des comptes supprimés
--
--  * Le formulaire d'inscription transmet le pays choisi (métadonnée
--    « country ») : le profil le reprend comme pays DÉCLARÉ s'il est un
--    code ISO valide. Sans pays (Google), la détection prend le relais.
--  * Purge : un compte supprimé mais gardé pour ses pièces comptables
--    perd aussi ses instantanés publiés et ses cadeaux (table en ajout
--    seul : seule cette fonction, sous le propriétaire, peut les effacer).
-- =====================================================================

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale  text  := v_meta ->> 'locale';
  v_name    text  := nullif(btrim(coalesce(v_meta ->> 'display_name', v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
  v_country text  := upper(nullif(btrim(coalesce(v_meta ->> 'country', '')), ''));
begin
  -- Code ISO 3166-1 alpha-2 (le site ne propose que des codes valides ; on revérifie la forme).
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    v_country := null;
  end if;
  insert into app.profiles (id, locale, display_name, country_code, country_source)
  values (
    new.id,
    case when v_locale in ('fr', 'en') then v_locale else 'fr' end,
    left(v_name, 80),
    v_country,
    case when v_country is null then null else 'declared' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app.handle_new_auth_user() from public;

alter table app.profiles add column purged_at timestamptz;

/**
 * Efface ce qui reste publié d'un compte supprimé (docs/15 §5) :
 * instantanés servis aux destinataires et cadeaux. Les commandes, paiements,
 * licences et le journal restent (pièces comptables). Idempotent.
 */
create function app.purge_deleted_account(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshots integer;
begin
  if not exists (select 1 from app.profiles where id = p_user_id and deleted_at is not null) then
    raise exception 'ACCOUNT_NOT_DELETED' using errcode = 'P0001';
  end if;
  update app.experiences set current_snapshot_id = null where owner_id = p_user_id and current_snapshot_id is not null;
  delete from app.experience_snapshots s using app.experiences e where s.experience_id = e.id and e.owner_id = p_user_id;
  get diagnostics v_snapshots = row_count;
  delete from app.gifts where owner_id = p_user_id;
  update app.profiles set purged_at = now() where id = p_user_id;
  return v_snapshots;
end;
$$;

revoke all on function app.purge_deleted_account(uuid) from public;
grant execute on function app.purge_deleted_account(uuid) to zaweli_api;

-- =====================================================================
-- ZAWELI · Migration 1300 — Profil pré-rempli à l'inscription
--
-- L'inscription (e-mail et mot de passe, ou Google) transmet des
-- métadonnées : la langue de la page d'inscription et, si elle est
-- connue, le nom affiché. Le profil créé par le déclencheur les reprend,
-- en ne gardant que des valeurs valides (langue fr | en, nom borné).
-- Google fournit `full_name` ou `name` : il sert de nom affiché par défaut.
-- =====================================================================

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale text  := v_meta ->> 'locale';
  v_name   text  := nullif(btrim(coalesce(v_meta ->> 'display_name', v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
begin
  insert into app.profiles (id, locale, display_name)
  values (
    new.id,
    case when v_locale in ('fr', 'en') then v_locale else 'fr' end,
    left(v_name, 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app.handle_new_auth_user() from public;

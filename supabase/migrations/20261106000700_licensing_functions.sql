-- =====================================================================
-- ZAWELI · Migration 0700 — Fonctions de licences et de quotas
--
-- Ces fonctions sont appelées par l'API À L'INTÉRIEUR de ses transactions.
-- Elles verrouillent les lignes concernées (SELECT … FOR UPDATE) : deux
-- publications concurrentes ne peuvent pas consommer le même droit.
--
-- Erreurs : exception SQLSTATE P0001 dont le message est un code métier
-- stable (ex. LICENSE_RECIPIENT_LIMIT_REACHED), traduit par l'API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Licence gratuite (idempotent)
-- ---------------------------------------------------------------------

create function app.ensure_free_license(p_user_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_plan app.plans;
  v_id   uuid;
begin
  select * into v_plan from app.plans where is_free and is_active;
  if not found then
    raise exception 'FREE_PLAN_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  insert into app.licenses (
    user_id, plan_id, source, status, starts_at, ends_at, activated_at,
    duration_days, start_policy, publications_max, recipients_max, ai_generations_max,
    template_access_mode, template_access_tag, edit_policy, edit_days, max_publications_per_day
  ) values (
    p_user_id, v_plan.id, 'free', 'active', now(),
    case when v_plan.duration_days is null then null else now() + make_interval(days => v_plan.duration_days) end,
    now(),
    v_plan.duration_days, v_plan.start_policy, v_plan.publications_max, v_plan.recipients_max, v_plan.ai_generations_max,
    v_plan.template_access_mode, v_plan.template_access_tag, v_plan.edit_policy, v_plan.edit_days, v_plan.max_publications_per_day
  )
  on conflict (user_id) where source = 'free' do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from app.licenses where user_id = p_user_id and source = 'free';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Activation d'une licence achetée (appelée au traitement du webhook)
-- Idempotent : une commande ne crée jamais deux licences.
-- ---------------------------------------------------------------------

create function app.activate_purchase_license(p_order_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_order app.orders;
  v_plan  app.plans;
  v_id    uuid;
  v_start timestamptz;
begin
  select * into v_order from app.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_order.kind <> 'license' then
    raise exception 'ORDER_KIND_NOT_LICENSE' using errcode = 'P0001';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'LICENSE_ORDER_NOT_PAID' using errcode = 'P0001';
  end if;

  select id into v_id from app.licenses where order_id = p_order_id;
  if v_id is not null then
    return v_id;
  end if;

  select * into v_plan from app.plans where id = v_order.plan_id;

  v_start := case v_plan.start_policy
               when 'on_first_publication' then null
               when 'on_payment_confirmed' then v_order.paid_at
               else now()
             end;

  insert into app.licenses (
    user_id, plan_id, order_id, source, status, starts_at, ends_at, activated_at,
    duration_days, start_policy, publications_max, recipients_max, ai_generations_max,
    template_access_mode, template_access_tag, edit_policy, edit_days, max_publications_per_day
  ) values (
    v_order.user_id, v_plan.id, v_order.id, 'purchase', 'active', v_start,
    case when v_start is null or v_plan.duration_days is null then null
         else v_start + make_interval(days => v_plan.duration_days) end,
    now(),
    v_plan.duration_days, v_plan.start_policy, v_plan.publications_max, v_plan.recipients_max, v_plan.ai_generations_max,
    v_plan.template_access_mode, v_plan.template_access_tag, v_plan.edit_policy, v_plan.edit_days, v_plan.max_publications_per_day
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Consommation d'une création à la publication (décision C2)
-- ---------------------------------------------------------------------

create function app.consume_publication(
  p_user_id       uuid,
  p_license_id    uuid,
  p_experience_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_license    app.licenses;
  v_experience app.experiences;
  v_id         uuid;
begin
  -- 1. Verrouiller la licence (sérialise les publications concurrentes).
  select * into v_license from app.licenses where id = p_license_id for update;
  if not found or v_license.user_id <> p_user_id then
    raise exception 'LICENSE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_license.status <> 'active' then
    raise exception 'LICENSE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if v_license.starts_at is not null and v_license.starts_at > now() then
    raise exception 'LICENSE_NOT_STARTED' using errcode = 'P0001';
  end if;
  if v_license.ends_at is not null and v_license.ends_at <= now() then
    raise exception 'LICENSE_EXPIRED' using errcode = 'P0001';
  end if;

  -- 2. Verrouiller l'expérience.
  select * into v_experience from app.experiences where id = p_experience_id for update;
  if not found or v_experience.owner_id <> p_user_id then
    raise exception 'EXPERIENCE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from app.license_consumptions where experience_id = p_experience_id) then
    raise exception 'EXPERIENCE_ALREADY_CONSUMED' using errcode = 'P0001';
  end if;
  if v_experience.status <> 'draft' then
    raise exception 'EXPERIENCE_NOT_DRAFT' using errcode = 'P0001';
  end if;

  -- 3. Accès au template.
  if v_license.template_access_mode = 'tagged' and not exists (
       select 1 from app.template_access_tags t
        where t.template_id = v_experience.template_id
          and t.tag = v_license.template_access_tag
     ) then
    raise exception 'LICENSE_TEMPLATE_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  -- 4. Quotas.
  if v_license.publications_max is not null
     and v_license.publications_used >= v_license.publications_max then
    raise exception 'LICENSE_PUBLICATION_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  if (select count(*) from app.license_consumptions c
       where c.license_id = p_license_id
         and c.consumed_at > now() - interval '24 hours') >= v_license.max_publications_per_day then
    raise exception 'LICENSE_DAILY_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  -- 5. Destinataires (MULTI-USE) : liaison définitive à la première publication.
  if v_license.recipients_max is not null and not exists (
       select 1 from app.license_recipients r
        where r.license_id = p_license_id and r.recipient_id = v_experience.recipient_id
     ) then
    if (select count(*) from app.license_recipients r where r.license_id = p_license_id)
       >= v_license.recipients_max then
      raise exception 'LICENSE_RECIPIENT_LIMIT_REACHED' using errcode = 'P0001';
    end if;
    insert into app.license_recipients (license_id, recipient_id, bound_by_experience_id)
    values (p_license_id, v_experience.recipient_id, p_experience_id);
  end if;

  -- 6. Consommer.
  insert into app.license_consumptions (license_id, experience_id)
  values (p_license_id, p_experience_id)
  returning id into v_id;

  update app.licenses
     set publications_used = publications_used + 1,
         starts_at = coalesce(starts_at, now()),
         ends_at = case
                     when starts_at is null and duration_days is not null
                       then now() + make_interval(days => duration_days)
                     else ends_at
                   end
   where id = p_license_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Quotas IA : réserver avant l'appel, solder après
-- ---------------------------------------------------------------------

create function app.reserve_ai_generation(p_user_id uuid, p_license_id uuid, p_task text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_license app.licenses;
  v_id      uuid;
begin
  select * into v_license from app.licenses where id = p_license_id for update;
  if not found or v_license.user_id <> p_user_id then
    raise exception 'LICENSE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_license.status <> 'active'
     or (v_license.ends_at is not null and v_license.ends_at <= now()) then
    raise exception 'LICENSE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if v_license.ai_generations_used >= v_license.ai_generations_max then
    raise exception 'AI_QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;

  update app.licenses set ai_generations_used = ai_generations_used + 1 where id = p_license_id;

  insert into app.ai_generations (user_id, license_id, task)
  values (p_user_id, p_license_id, p_task)
  returning id into v_id;

  return v_id;
end;
$$;

create function app.settle_ai_generation(
  p_generation_id     uuid,
  p_success           boolean,
  p_model             text default null,
  p_prompt_tokens     integer default null,
  p_completion_tokens integer default null,
  p_cost_estimate_usd numeric default null,
  p_error_code        text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_generation app.ai_generations;
begin
  select * into v_generation from app.ai_generations where id = p_generation_id for update;
  if not found then
    raise exception 'AI_GENERATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_generation.status <> 'reserved' then
    return; -- déjà soldée : idempotent
  end if;

  update app.ai_generations
     set status = case when p_success then 'succeeded' else 'failed' end::app.ai_generation_status,
         model = p_model,
         prompt_tokens = p_prompt_tokens,
         completion_tokens = p_completion_tokens,
         cost_estimate_usd = p_cost_estimate_usd,
         error_code = p_error_code,
         settled_at = now()
   where id = p_generation_id;

  -- Un échec ne consomme pas le quota.
  if not p_success then
    update app.licenses
       set ai_generations_used = ai_generations_used - 1
     where id = v_generation.license_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Expiration (tâche planifiée)
-- ---------------------------------------------------------------------

create function app.expire_licenses()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update app.licenses
     set status = 'expired'
   where status = 'active'
     and ends_at is not null
     and ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

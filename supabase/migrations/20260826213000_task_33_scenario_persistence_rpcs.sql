create or replace function public.save_simulator_scenario(
  p_business_id uuid,
  p_scenario_id uuid,
  p_name text,
  p_creation_request_id uuid,
  p_overrides jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_scenario_id uuid;
  override_pair record;
  override_numeric numeric;
  allowed_keys constant text[] := array[
    'customer_value',
    'cpl',
    'ad_spend',
    'show_rate',
    'qualification_rate',
    'close_rate',
    'fixed_costs',
    'variable_costs',
    'upsells',
    'renewals',
    'backend_revenue'
  ]::text[];
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to save a simulator scenario.';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can save simulator scenarios.';
  end if;

  if p_business_id is null or p_creation_request_id is null then
    raise invalid_parameter_value using message = 'Business and creation request IDs are required.';
  end if;

  if p_name is null
    or char_length(p_name) not between 1 and 120
    or p_name !~ '[^[:space:]]'
    or p_name ~ '^[[:space:]]'
    or p_name ~ '[[:space:]]$' then
    raise invalid_parameter_value using message = 'Scenario name must be 1-120 characters with no leading or trailing whitespace.';
  end if;

  if jsonb_typeof(p_overrides) is distinct from 'object' then
    raise invalid_parameter_value using message = 'Scenario overrides must be a JSON object.';
  end if;

  for override_pair in select key, value from pg_catalog.jsonb_each(p_overrides)
  loop
    if not (override_pair.key = any(allowed_keys)) then
      raise invalid_parameter_value using message = 'Unsupported simulator override key.';
    end if;

    if pg_catalog.jsonb_typeof(override_pair.value) <> 'number' then
      raise invalid_parameter_value using message = 'Simulator override values must be numeric.';
    end if;

    begin
      override_numeric := (override_pair.value #>> '{}')::numeric;
    exception when others then
      raise invalid_parameter_value using message = 'Simulator override value is not a valid numeric.';
    end;

    if override_numeric = 'NaN'::numeric or override_numeric < 0 then
      raise invalid_parameter_value using message = 'Simulator override values must be finite and non-negative.';
    end if;

    if override_pair.key in ('show_rate', 'qualification_rate', 'close_rate')
      and override_numeric > 1 then
      raise invalid_parameter_value using message = 'Simulator conversion rates cannot exceed 100%.';
    end if;
  end loop;

  if p_scenario_id is null then
    insert into public.simulator_scenarios (
      business_id,
      name,
      creation_request_id
    ) values (
      p_business_id,
      p_name,
      p_creation_request_id
    )
    on conflict (business_id, creation_request_id) do update set
      name = excluded.name
    returning id into resolved_scenario_id;
  else
    update public.simulator_scenarios
    set name = p_name
    where id = p_scenario_id
      and business_id = p_business_id
    returning id into resolved_scenario_id;

    if resolved_scenario_id is null then
      raise invalid_parameter_value using message = 'Scenario does not belong to this business.';
    end if;
  end if;

  delete from public.simulator_scenario_overrides
  where business_id = p_business_id
    and scenario_id = resolved_scenario_id;

  insert into public.simulator_scenario_overrides (
    business_id,
    scenario_id,
    override_key,
    override_value
  )
  select
    p_business_id,
    resolved_scenario_id,
    pair.key,
    (pair.value #>> '{}')::numeric
  from pg_catalog.jsonb_each(p_overrides) as pair;

  return resolved_scenario_id;
end;
$$;

revoke all on function public.save_simulator_scenario(uuid, uuid, text, uuid, jsonb) from public;
revoke all on function public.save_simulator_scenario(uuid, uuid, text, uuid, jsonb) from anon;
revoke all on function public.save_simulator_scenario(uuid, uuid, text, uuid, jsonb) from authenticated;
grant execute on function public.save_simulator_scenario(uuid, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.save_simulator_scenario(uuid, uuid, text, uuid, jsonb) to service_role;

create or replace function public.duplicate_simulator_scenario(
  p_business_id uuid,
  p_source_scenario_id uuid,
  p_name text,
  p_creation_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to duplicate a simulator scenario.';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can duplicate simulator scenarios.';
  end if;

  if p_business_id is null or p_source_scenario_id is null or p_creation_request_id is null then
    raise invalid_parameter_value using message = 'Business, source scenario, and creation request IDs are required.';
  end if;

  if p_name is null
    or char_length(p_name) not between 1 and 120
    or p_name !~ '[^[:space:]]'
    or p_name ~ '^[[:space:]]'
    or p_name ~ '[[:space:]]$' then
    raise invalid_parameter_value using message = 'Scenario name must be 1-120 characters with no leading or trailing whitespace.';
  end if;

  if not exists (
    select 1
    from public.simulator_scenarios as source
    where source.id = p_source_scenario_id
      and source.business_id = p_business_id
  ) then
    raise invalid_parameter_value using message = 'Source scenario does not belong to this business.';
  end if;

  insert into public.simulator_scenarios (
    business_id,
    name,
    creation_request_id
  ) values (
    p_business_id,
    p_name,
    p_creation_request_id
  )
  on conflict (business_id, creation_request_id) do update set
    name = excluded.name
  returning id into duplicate_id;

  delete from public.simulator_scenario_overrides
  where business_id = p_business_id
    and scenario_id = duplicate_id;

  insert into public.simulator_scenario_overrides (
    business_id,
    scenario_id,
    override_key,
    override_value
  )
  select
    source.business_id,
    duplicate_id,
    source.override_key,
    source.override_value
  from public.simulator_scenario_overrides as source
  where source.business_id = p_business_id
    and source.scenario_id = p_source_scenario_id;

  return duplicate_id;
end;
$$;

revoke all on function public.duplicate_simulator_scenario(uuid, uuid, text, uuid) from public;
revoke all on function public.duplicate_simulator_scenario(uuid, uuid, text, uuid) from anon;
revoke all on function public.duplicate_simulator_scenario(uuid, uuid, text, uuid) from authenticated;
grant execute on function public.duplicate_simulator_scenario(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.duplicate_simulator_scenario(uuid, uuid, text, uuid) to service_role;

comment on function public.save_simulator_scenario(uuid, uuid, text, uuid, jsonb) is
  'Task 33 atomic save/update for sparse simulator overrides. The function authorizes the business explicitly and writes only Task 32 scenario tables; historical actual tables are never modified.';

comment on function public.duplicate_simulator_scenario(uuid, uuid, text, uuid) is
  'Task 33 atomic scenario duplication with a new identity and copied sparse overrides. Historical actual tables are never modified.';

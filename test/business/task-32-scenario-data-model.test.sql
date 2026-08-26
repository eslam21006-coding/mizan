begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('32320000-0000-4000-8000-000000000001', 'task32-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('32320000-0000-4000-8000-000000000002', 'task32-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('32320000-0000-4000-8000-000000000003', 'task32-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('32320000-0000-4000-8000-000000000004', 'task32-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'a0320000-0000-4000-8000-000000000001',
    'Task 32 Business A',
    'EGP',
    'Africa/Cairo',
    '32320000-0000-4000-8000-000000000001',
    '3232a000-0000-4000-8000-000000000001'
  ),
  (
    'b0320000-0000-4000-8000-000000000002',
    'Task 32 Business B',
    'SAR',
    'Asia/Riyadh',
    '32320000-0000-4000-8000-000000000002',
    '3232b000-0000-4000-8000-000000000002'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'a0320000-0000-4000-8000-000000000001',
  '32320000-0000-4000-8000-000000000003',
  'member'
);

-- Historical actual fixture. Task 32 scenario lifecycle operations below must not touch this row.
insert into public.monthly_periods (
  id,
  business_id,
  month_start,
  new_customers,
  total_paying_customers,
  unallocated_gross_cash_collected,
  unallocated_refunds,
  adjustment_note,
  created_at,
  updated_at
)
values (
  '3232c000-0000-4000-8000-000000000001',
  'a0320000-0000-4000-8000-000000000001',
  date '2026-07-01',
  10,
  12,
  12500.25,
  250.50,
  'Task 32 immutable actual fixture',
  timestamptz '2026-08-01 10:00:00+00',
  timestamptz '2026-08-01 10:00:00+00'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"32320000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

-- SAVE: owner A can save a named scenario and the exact approved override keys.
insert into public.simulator_scenarios (
  id, business_id, name, creation_request_id
)
values (
  '3232d000-0000-4000-8000-000000000001',
  'a0320000-0000-4000-8000-000000000001',
  'Base Growth Scenario',
  '3232e000-0000-4000-8000-000000000001'
);

insert into public.simulator_scenario_overrides (
  business_id, scenario_id, override_key, override_value
)
values
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'customer_value', 1500),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'cpl', 35.50),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'ad_spend', 12000),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'show_rate', 0.70),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'qualification_rate', 0.60),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'close_rate', 0.30),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'fixed_costs', 7000),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'variable_costs', 275),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'upsells', 2500),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'renewals', 1800),
  ('a0320000-0000-4000-8000-000000000001', '3232d000-0000-4000-8000-000000000001', 'backend_revenue', 5000);

do $$
begin
  if (select count(*) from public.simulator_scenarios) <> 1 then
    raise exception 'owner could not read own saved scenario';
  end if;

  if (
    select count(*)
    from public.simulator_scenario_overrides
    where scenario_id = '3232d000-0000-4000-8000-000000000001'
  ) <> 11 then
    raise exception 'approved override set was not saved completely';
  end if;

  begin
    insert into public.simulator_scenarios (business_id, name, creation_request_id)
    values (
      'a0320000-0000-4000-8000-000000000001',
      'Duplicate Delivery',
      '3232e000-0000-4000-8000-000000000001'
    );
    raise exception 'duplicate scenario creation request created a second scenario';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.simulator_scenario_overrides (
      business_id, scenario_id, override_key, override_value
    ) values (
      'a0320000-0000-4000-8000-000000000001',
      '3232d000-0000-4000-8000-000000000001',
      'invented_metric',
      1
    );
    raise exception 'unapproved scenario override key was accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.simulator_scenario_overrides
    set override_value = 1.01
    where scenario_id = '3232d000-0000-4000-8000-000000000001'
      and override_key = 'show_rate';
    raise exception 'scenario rate above 100 percent was accepted';
  exception when check_violation then
    null;
  end;

  begin
    update public.simulator_scenario_overrides
    set override_value = -1
    where scenario_id = '3232d000-0000-4000-8000-000000000001'
      and override_key = 'cpl';
    raise exception 'negative scenario override was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.simulator_scenarios (business_id, name, creation_request_id)
    values (
      'b0320000-0000-4000-8000-000000000002',
      'Cross Tenant Scenario',
      '3232e000-0000-4000-8000-000000000099'
    );
    raise exception 'owner A saved a scenario in owner B business';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- RENAME + override editing are the mutable parts of a saved scenario.
update public.simulator_scenarios
set name = 'Renamed Growth Scenario'
where id = '3232d000-0000-4000-8000-000000000001';

update public.simulator_scenario_overrides
set override_value = 40
where scenario_id = '3232d000-0000-4000-8000-000000000001'
  and override_key = 'cpl';

-- DUPLICATE: a copy is a new scenario identity with copied sparse overrides.
insert into public.simulator_scenarios (
  id, business_id, name, creation_request_id
)
select
  '3232d000-0000-4000-8000-000000000002',
  business_id,
  'Renamed Growth Scenario Copy',
  '3232e000-0000-4000-8000-000000000002'
from public.simulator_scenarios
where id = '3232d000-0000-4000-8000-000000000001';

insert into public.simulator_scenario_overrides (
  business_id, scenario_id, override_key, override_value
)
select
  business_id,
  '3232d000-0000-4000-8000-000000000002',
  override_key,
  override_value
from public.simulator_scenario_overrides
where scenario_id = '3232d000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1
    from public.simulator_scenarios
    where id = '3232d000-0000-4000-8000-000000000001'
      and name = 'Renamed Growth Scenario'
  ) then
    raise exception 'scenario rename did not persist';
  end if;

  if not exists (
    select 1
    from public.simulator_scenario_overrides
    where scenario_id = '3232d000-0000-4000-8000-000000000001'
      and override_key = 'cpl'
      and override_value = 40
  ) then
    raise exception 'scenario override edit did not persist';
  end if;

  if (
    select count(*)
    from public.simulator_scenario_overrides
    where scenario_id = '3232d000-0000-4000-8000-000000000002'
  ) <> 11 then
    raise exception 'scenario duplicate did not copy all overrides';
  end if;

  begin
    update public.simulator_scenarios
    set business_id = 'b0320000-0000-4000-8000-000000000002'
    where id = '3232d000-0000-4000-8000-000000000001';
    raise exception 'scenario moved between businesses';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.simulator_scenarios
    set creation_request_id = '3232e000-0000-4000-8000-000000000003'
    where id = '3232d000-0000-4000-8000-000000000001';
    raise exception 'scenario creation request id was mutable';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.simulator_scenario_overrides
    set override_key = 'cpl'
    where scenario_id = '3232d000-0000-4000-8000-000000000001'
      and override_key = 'ad_spend';
    raise exception 'scenario override identity was mutable';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- DELETE: deleting a scenario removes its override rows but not historical actuals.
delete from public.simulator_scenarios
where id = '3232d000-0000-4000-8000-000000000002';

do $$
begin
  if exists (
    select 1 from public.simulator_scenarios
    where id = '3232d000-0000-4000-8000-000000000002'
  ) then
    raise exception 'owner could not delete duplicated scenario';
  end if;

  if exists (
    select 1 from public.simulator_scenario_overrides
    where scenario_id = '3232d000-0000-4000-8000-000000000002'
  ) then
    raise exception 'scenario delete did not cascade to its override rows';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"32320000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.simulator_scenarios (
  id, business_id, name, creation_request_id
)
values (
  '3232d000-0000-4000-8000-000000000010',
  'b0320000-0000-4000-8000-000000000002',
  'Owner B Scenario',
  '3232e000-0000-4000-8000-000000000010'
);

insert into public.simulator_scenario_overrides (
  business_id, scenario_id, override_key, override_value
)
values (
  'b0320000-0000-4000-8000-000000000002',
  '3232d000-0000-4000-8000-000000000010',
  'ad_spend',
  9000
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"32320000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if exists (
    select 1 from public.simulator_scenarios
    where id = '3232d000-0000-4000-8000-000000000010'
  ) then
    raise exception 'owner A can read owner B scenario';
  end if;

  update public.simulator_scenarios
  set name = 'Cross Tenant Rename'
  where id = '3232d000-0000-4000-8000-000000000010';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A renamed owner B scenario';
  end if;

  delete from public.simulator_scenarios
  where id = '3232d000-0000-4000-8000-000000000010';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A deleted owner B scenario';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"32320000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if (select count(*) from public.simulator_scenarios) <> 1 then
    raise exception 'business member could not read business scenario';
  end if;

  if (select count(*) from public.simulator_scenario_overrides) <> 11 then
    raise exception 'business member could not read business scenario overrides';
  end if;

  update public.simulator_scenarios
  set name = 'Member Rename'
  where id = '3232d000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'business member renamed scenario';
  end if;

  update public.simulator_scenario_overrides
  set override_value = 1
  where scenario_id = '3232d000-0000-4000-8000-000000000001'
    and override_key = 'cpl';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'business member edited scenario override';
  end if;

  delete from public.simulator_scenarios
  where id = '3232d000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'business member deleted scenario';
  end if;

  begin
    insert into public.simulator_scenarios (business_id, name, creation_request_id)
    values (
      'a0320000-0000-4000-8000-000000000001',
      'Member Scenario',
      '3232e000-0000-4000-8000-000000000020'
    );
    raise exception 'business member saved scenario';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"32320000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if (select count(*) from public.simulator_scenarios) <> 2 then
    raise exception 'admin could not read all scenarios';
  end if;
end $$;

update public.simulator_scenarios
set name = 'Admin Renamed Owner B Scenario'
where id = '3232d000-0000-4000-8000-000000000010';

insert into public.simulator_scenarios (
  id, business_id, name, creation_request_id
)
values (
  '3232d000-0000-4000-8000-000000000011',
  'b0320000-0000-4000-8000-000000000002',
  'Admin Scenario',
  '3232e000-0000-4000-8000-000000000011'
);

delete from public.simulator_scenarios
where id = '3232d000-0000-4000-8000-000000000011';

do $$
begin
  if not exists (
    select 1
    from public.simulator_scenarios
    where id = '3232d000-0000-4000-8000-000000000010'
      and name = 'Admin Renamed Owner B Scenario'
  ) then
    raise exception 'admin could not manage another business scenario';
  end if;
end $$;

reset role;
set local role anon;

do $$
begin
  begin
    perform 1 from public.simulator_scenarios;
    raise exception 'anon read public.simulator_scenarios';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform 1 from public.simulator_scenario_overrides;
    raise exception 'anon read public.simulator_scenario_overrides';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- Hard invariant: all scenario lifecycle/security operations left historical actuals untouched.
do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where id = '3232c000-0000-4000-8000-000000000001'
      and business_id = 'a0320000-0000-4000-8000-000000000001'
      and month_start = date '2026-07-01'
      and new_customers = 10
      and total_paying_customers = 12
      and unallocated_gross_cash_collected = 12500.25
      and unallocated_refunds = 250.50
      and adjustment_note = 'Task 32 immutable actual fixture'
      and created_at = timestamptz '2026-08-01 10:00:00+00'
      and updated_at = timestamptz '2026-08-01 10:00:00+00'
  ) then
    raise exception 'scenario operations mutated historical monthly actual data';
  end if;

  if (select count(*) from public.monthly_periods where business_id = 'a0320000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'scenario operations changed historical monthly period row count';
  end if;
end $$;

rollback;

begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('33330000-0000-4000-8000-000000000001', 'task33-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('33330000-0000-4000-8000-000000000002', 'task33-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('33330000-0000-4000-8000-000000000003', 'task33-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('33330000-0000-4000-8000-000000000004', 'task33-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'a0330000-0000-4000-8000-000000000001',
    'Task 33 Business A',
    'EGP',
    'Africa/Cairo',
    '33330000-0000-4000-8000-000000000001',
    '3333a000-0000-4000-8000-000000000001'
  ),
  (
    'b0330000-0000-4000-8000-000000000002',
    'Task 33 Business B',
    'SAR',
    'Asia/Riyadh',
    '33330000-0000-4000-8000-000000000002',
    '3333b000-0000-4000-8000-000000000002'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'a0330000-0000-4000-8000-000000000001',
  '33330000-0000-4000-8000-000000000003',
  'member'
);

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
  '3333c000-0000-4000-8000-000000000001',
  'a0330000-0000-4000-8000-000000000001',
  date '2026-08-01',
  12,
  15,
  20000,
  500,
  'Task 33 immutable actual fixture',
  timestamptz '2026-08-26 12:00:00+00',
  timestamptz '2026-08-26 12:00:00+00'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33330000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  scenario_id uuid;
  repeated_id uuid;
  duplicate_id uuid;
begin
  scenario_id := public.save_simulator_scenario(
    'a0330000-0000-4000-8000-000000000001',
    null,
    'سيناريو النمو',
    '3333d000-0000-4000-8000-000000000001',
    '{"ad_spend":"12000.125","show_rate":"0.7","backend_revenue":"2500.25"}'::jsonb
  );

  if scenario_id is null then
    raise exception 'scenario RPC did not return an id';
  end if;

  if (
    select count(*)
    from public.simulator_scenario_overrides as override_row
    where override_row.scenario_id = scenario_id
  ) <> 3 then
    raise exception 'scenario RPC did not persist the sparse override set';
  end if;

  if not exists (
    select 1
    from public.simulator_scenario_overrides as override_row
    where override_row.scenario_id = scenario_id
      and override_row.override_key = 'ad_spend'
      and override_row.override_value = 12000.125
  ) then
    raise exception 'scenario RPC lost exact decimal precision';
  end if;

  repeated_id := public.save_simulator_scenario(
    'a0330000-0000-4000-8000-000000000001',
    null,
    'سيناريو النمو - إعادة إرسال',
    '3333d000-0000-4000-8000-000000000001',
    '{"ad_spend":"13000","close_rate":"0.31"}'::jsonb
  );

  if repeated_id <> scenario_id then
    raise exception 'creation request idempotency returned a different scenario';
  end if;

  if (
    select count(*)
    from public.simulator_scenario_overrides as override_row
    where override_row.scenario_id = scenario_id
  ) <> 2 then
    raise exception 'idempotent save did not atomically replace sparse overrides';
  end if;

  perform public.save_simulator_scenario(
    'a0330000-0000-4000-8000-000000000001',
    scenario_id,
    'سيناريو النمو المعدل',
    '3333d000-0000-4000-8000-000000000001',
    '{"customer_value":"1750.125","ad_spend":"14000"}'::jsonb
  );

  if not exists (
    select 1
    from public.simulator_scenarios
    where id = scenario_id
      and name = 'سيناريو النمو المعدل'
  ) then
    raise exception 'scenario update did not persist the name';
  end if;

  duplicate_id := public.duplicate_simulator_scenario(
    'a0330000-0000-4000-8000-000000000001',
    scenario_id,
    'سيناريو النمو المعدل - نسخة',
    '3333d000-0000-4000-8000-000000000002'
  );

  if duplicate_id = scenario_id then
    raise exception 'duplicate reused the source scenario identity';
  end if;

  if (
    select count(*)
    from public.simulator_scenario_overrides as override_row
    where override_row.scenario_id = duplicate_id
  ) <> 2 then
    raise exception 'duplicate did not copy sparse overrides';
  end if;

  begin
    perform public.save_simulator_scenario(
      'a0330000-0000-4000-8000-000000000001',
      scenario_id,
      E'\tاسم غير صالح',
      '3333d000-0000-4000-8000-000000000001',
      '{}'::jsonb
    );
    raise exception 'RPC accepted leading whitespace';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_simulator_scenario(
      'a0330000-0000-4000-8000-000000000001',
      scenario_id,
      'سيناريو النمو المعدل',
      '3333d000-0000-4000-8000-000000000001',
      '{"cpl":"NaN"}'::jsonb
    );
    raise exception 'RPC accepted NaN override';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_simulator_scenario(
      'a0330000-0000-4000-8000-000000000001',
      scenario_id,
      'سيناريو النمو المعدل',
      '3333d000-0000-4000-8000-000000000001',
      '{"show_rate":"1.01"}'::jsonb
    );
    raise exception 'RPC accepted a conversion rate above 100 percent';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_simulator_scenario(
      'b0330000-0000-4000-8000-000000000002',
      null,
      'Cross tenant',
      '3333d000-0000-4000-8000-000000000099',
      '{}'::jsonb
    );
    raise exception 'owner A created a scenario for owner B';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33330000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  source_id uuid;
begin
  select id into source_id
  from public.simulator_scenarios
  where business_id = 'a0330000-0000-4000-8000-000000000001'
  order by created_at
  limit 1;

  begin
    perform public.save_simulator_scenario(
      'a0330000-0000-4000-8000-000000000001',
      source_id,
      'Member edit',
      '3333d000-0000-4000-8000-000000000001',
      '{}'::jsonb
    );
    raise exception 'read-only business member edited a scenario through RPC';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.duplicate_simulator_scenario(
      'a0330000-0000-4000-8000-000000000001',
      source_id,
      'Member copy',
      '3333d000-0000-4000-8000-000000000020'
    );
    raise exception 'read-only business member duplicated a scenario through RPC';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33330000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
declare
  admin_scenario uuid;
begin
  admin_scenario := public.save_simulator_scenario(
    'b0330000-0000-4000-8000-000000000002',
    null,
    'Admin scenario',
    '3333d000-0000-4000-8000-000000000030',
    '{"ad_spend":"9000"}'::jsonb
  );

  if admin_scenario is null then
    raise exception 'admin could not save scenario for another business';
  end if;
end $$;

reset role;

-- Scenario RPCs must never mutate the historical actual fixture.
do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where id = '3333c000-0000-4000-8000-000000000001'
      and business_id = 'a0330000-0000-4000-8000-000000000001'
      and month_start = date '2026-08-01'
      and new_customers = 12
      and total_paying_customers = 15
      and unallocated_gross_cash_collected = 20000
      and unallocated_refunds = 500
      and adjustment_note = 'Task 33 immutable actual fixture'
      and created_at = timestamptz '2026-08-26 12:00:00+00'
      and updated_at = timestamptz '2026-08-26 12:00:00+00'
  ) then
    raise exception 'Task 33 scenario RPCs mutated historical actual data';
  end if;
end $$;

rollback;

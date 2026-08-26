begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '32329999-0000-4000-8000-000000000001',
  'task32-input-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  'a0329999-0000-4000-8000-000000000001',
  'Task 32 Input Hardening Business',
  'EGP',
  'Africa/Cairo',
  '32329999-0000-4000-8000-000000000001',
  '3232a999-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"32329999-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    insert into public.simulator_scenarios (business_id, name, creation_request_id)
    values (
      'a0329999-0000-4000-8000-000000000001',
      E'\t\n',
      '3232e999-0000-4000-8000-000000000001'
    );
    raise exception 'whitespace-only scenario name was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.simulator_scenarios (business_id, name, creation_request_id)
    values (
      'a0329999-0000-4000-8000-000000000001',
      E'\tScenario\t',
      '3232e999-0000-4000-8000-000000000002'
    );
    raise exception 'tab-padded scenario name was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.simulator_scenarios (business_id, name, creation_request_id)
    values (
      'a0329999-0000-4000-8000-000000000001',
      E'\nScenario',
      '3232e999-0000-4000-8000-000000000003'
    );
    raise exception 'newline-prefixed scenario name was accepted';
  exception when check_violation then
    null;
  end;
end $$;

insert into public.simulator_scenarios (
  id, business_id, name, creation_request_id
)
values (
  '3232d999-0000-4000-8000-000000000001',
  'a0329999-0000-4000-8000-000000000001',
  'Valid Scenario',
  '3232e999-0000-4000-8000-000000000004'
);

do $$
begin
  begin
    insert into public.simulator_scenario_overrides (
      business_id, scenario_id, override_key, override_value
    ) values (
      'a0329999-0000-4000-8000-000000000001',
      '3232d999-0000-4000-8000-000000000001',
      'cpl',
      'NaN'::numeric
    );
    raise exception 'NaN scenario override was accepted';
  exception when check_violation then
    null;
  end;
end $$;

reset role;
rollback;

begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('74747474-7474-4747-8747-747474740001', 'task3-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('74747474-7474-4747-8747-747474740002', 'task3-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('74747474-7474-4747-8747-747474740003', 'task3-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('74747474-7474-4747-8747-74747474a001', 'Task 3 Automatic LCP A', 'USD', 'Africa/Cairo', '74747474-7474-4747-8747-747474740001', '74747474-7474-4747-8747-74747474c001'),
  ('74747474-7474-4747-8747-74747474b002', 'Task 3 Missing Period B', 'USD', 'Africa/Cairo', '74747474-7474-4747-8747-747474740002', '74747474-7474-4747-8747-74747474c002');

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values
  ('74747474-7474-4747-8747-74747474e001', '74747474-7474-4747-8747-74747474a001', 'Acquisition', 'acquisition', 'fixed_monthly', '74747474-7474-4747-8747-74747474d001'),
  ('74747474-7474-4747-8747-74747474e002', '74747474-7474-4747-8747-74747474a001', 'Variable Fulfillment', 'fulfillment', 'per_customer', '74747474-7474-4747-8747-74747474d002'),
  ('74747474-7474-4747-8747-74747474e003', '74747474-7474-4747-8747-74747474a001', 'Variable Operations', 'overhead', 'per_customer', '74747474-7474-4747-8747-74747474d003'),
  ('74747474-7474-4747-8747-74747474e004', '74747474-7474-4747-8747-74747474a001', 'Variable Financial', 'financial', 'percentage_revenue', '74747474-7474-4747-8747-74747474d004'),
  ('74747474-7474-4747-8747-74747474e005', '74747474-7474-4747-8747-74747474a001', 'Fixed Overhead', 'overhead', 'fixed_monthly', '74747474-7474-4747-8747-74747474d005');

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers,
  unallocated_gross_cash_collected, unallocated_refunds
)
values
  ('74747474-7474-4747-8747-74747474f001', '74747474-7474-4747-8747-74747474a001', '2026-01-01', 2, 2, 1000, 0),
  ('74747474-7474-4747-8747-74747474f002', '74747474-7474-4747-8747-74747474a001', '2026-02-01', 0, 2, 1000, 0);

insert into public.monthly_expense_entries (
  id, business_id, monthly_period_id, expense_item_id,
  expense_name_snapshot, category_snapshot, cost_behavior_snapshot,
  input_value, customer_count_basis
)
values
  ('74747474-7474-4747-8747-747474741001', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f001', '74747474-7474-4747-8747-74747474e001', 'Acquisition', 'acquisition', 'fixed_monthly', 200, null),
  ('74747474-7474-4747-8747-747474741002', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f001', '74747474-7474-4747-8747-74747474e002', 'Variable Fulfillment', 'fulfillment', 'per_customer', 50, 'total_paying_customers'),
  ('74747474-7474-4747-8747-747474741003', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f001', '74747474-7474-4747-8747-74747474e003', 'Variable Operations', 'overhead', 'per_customer', 25, 'total_paying_customers'),
  ('74747474-7474-4747-8747-747474741004', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f001', '74747474-7474-4747-8747-74747474e004', 'Variable Financial', 'financial', 'percentage_revenue', 0.10, null),
  ('74747474-7474-4747-8747-747474741005', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f001', '74747474-7474-4747-8747-74747474e005', 'Fixed Overhead', 'overhead', 'fixed_monthly', 1000, null),
  ('74747474-7474-4747-8747-747474741006', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f002', '74747474-7474-4747-8747-74747474e001', 'Acquisition', 'acquisition', 'fixed_monthly', 0, null),
  ('74747474-7474-4747-8747-747474741007', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f002', '74747474-7474-4747-8747-74747474e002', 'Variable Fulfillment', 'fulfillment', 'per_customer', 0, 'total_paying_customers'),
  ('74747474-7474-4747-8747-747474741008', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f002', '74747474-7474-4747-8747-74747474e003', 'Variable Operations', 'overhead', 'per_customer', 0, 'total_paying_customers'),
  ('74747474-7474-4747-8747-747474741009', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f002', '74747474-7474-4747-8747-74747474e004', 'Variable Financial', 'financial', 'percentage_revenue', 0, null),
  ('74747474-7474-4747-8747-747474741010', '74747474-7474-4747-8747-74747474a001', '74747474-7474-4747-8747-74747474f002', '74747474-7474-4747-8747-74747474e005', 'Fixed Overhead', 'overhead', 'fixed_monthly', 1000, null);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source('74747474-7474-4747-8747-74747474a001', 'task3-fixture');
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740002","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source('74747474-7474-4747-8747-74747474b002', 'task3-fixture');
reset role;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency,
  normalized_outcome
)
values
  ('74747474-7474-4747-8747-74747474a001', 'task3-fixture', 'a-jan-1', gen_random_uuid(), 'task3-a1@example.test', '2026-01-05', 500, 'collection', 1, '74747474-7474-4747-8747-747474740001', '2026-01-05T10:00:00Z', '2026-01-05T10:00:00Z', 'USD', 'successful'),
  ('74747474-7474-4747-8747-74747474a001', 'task3-fixture', 'a-jan-2', gen_random_uuid(), 'task3-a2@example.test', '2026-01-06', 500, 'collection', 2, '74747474-7474-4747-8747-747474740001', '2026-01-06T10:00:00Z', '2026-01-06T10:00:00Z', 'USD', 'successful'),
  ('74747474-7474-4747-8747-74747474a001', 'task3-fixture', 'a-feb-1', gen_random_uuid(), 'task3-a1@example.test', '2026-02-05', 500, 'collection', 3, '74747474-7474-4747-8747-747474740001', '2026-02-05T10:00:00Z', '2026-02-05T10:00:00Z', 'USD', 'successful'),
  ('74747474-7474-4747-8747-74747474a001', 'task3-fixture', 'a-feb-2', gen_random_uuid(), 'task3-a2@example.test', '2026-02-06', 500, 'collection', 4, '74747474-7474-4747-8747-747474740001', '2026-02-06T10:00:00Z', '2026-02-06T10:00:00Z', 'USD', 'successful'),
  ('74747474-7474-4747-8747-74747474b002', 'task3-fixture', 'b-jan-1', gen_random_uuid(), 'task3-b1@example.test', '2026-01-05', 1000, 'collection', 1, '74747474-7474-4747-8747-747474740002', '2026-01-05T10:00:00Z', '2026-01-05T10:00:00Z', 'USD', 'successful');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.set_transaction_history_complete('74747474-7474-4747-8747-74747474a001', true);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740002","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.set_transaction_history_complete('74747474-7474-4747-8747-74747474b002', true);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  january_row record;
  february_row record;
  current_row record;
begin
  select * into strict january_row
  from public.customer_lifetime_contribution_profit_observations
  where business_id = '74747474-7474-4747-8747-74747474a001'
    and cohort_month = '2026-01-01'::date
    and observation_month = '2026-01-01'::date;

  if january_row.lifetime_net_cash is distinct from 1000
    or january_row.acquisition_costs is distinct from 200
    or january_row.variable_fulfillment_costs is distinct from 100
    or january_row.other_variable_costs is distinct from 50
    or january_row.payment_processing_costs is distinct from 100
    or january_row.variable_financial_costs is distinct from 100
    or january_row.lifetime_attributable_costs is distinct from 450
    or january_row.lifetime_contribution_profit is distinct from 550
    or january_row.lifetime_contribution_profit_per_customer is distinct from 275
    or january_row.lifetime_contribution_profit_text is distinct from '550'
    or january_row.lifetime_contribution_profit_per_customer_text is distinct from '275'
    or january_row.quality_state is distinct from 'estimated'
    or january_row.allocation_complete is not true
    or january_row.uses_automatic_allocation is not true
    or january_row.uses_explicit_allocation is not false
    or january_row.transaction_history_complete is not true
    or january_row.missing_relevant_period_count is distinct from 0
    or january_row.incomplete_relevant_period_count is distinct from 0 then
    raise exception 'Task 3 January automatic Lifetime Contribution Profit values are wrong';
  end if;

  select * into strict february_row
  from public.customer_lifetime_contribution_profit_observations
  where business_id = '74747474-7474-4747-8747-74747474a001'
    and cohort_month = '2026-01-01'::date
    and observation_month = '2026-02-01'::date;

  if february_row.lifetime_net_cash is distinct from 2000
    or february_row.lifetime_attributable_costs is distinct from 450
    or february_row.lifetime_contribution_profit is distinct from 1550
    or february_row.lifetime_contribution_profit_per_customer is distinct from 775
    or february_row.quality_state is distinct from 'estimated'
    or february_row.relevant_activity_month_count is distinct from 2 then
    raise exception 'Task 3 cumulative February Lifetime Contribution Profit values are wrong';
  end if;

  select * into strict current_row
  from public.customer_lifetime_contribution_profit
  where business_id = '74747474-7474-4747-8747-74747474a001'
    and cohort_month = '2026-01-01'::date;

  if current_row.lifetime_net_cash is distinct from 2000
    or current_row.lifetime_attributable_costs is distinct from 450
    or current_row.lifetime_contribution_profit is distinct from 1550
    or current_row.lifetime_contribution_profit_per_customer is distinct from 775
    or current_row.quality_state is distinct from 'estimated'
    or current_row.payment_processing_costs is distinct from current_row.variable_financial_costs then
    raise exception 'Task 3 current automatic Lifetime Contribution Profit snapshot is wrong';
  end if;

  if exists (
    select 1
    from public.customer_economics_cost_allocations as allocation
    join public.customer_economics_authoritative_cost_pools as pool
      on pool.authoritative_source_type = allocation.authoritative_source_type
     and pool.authoritative_source_id = allocation.authoritative_source_id
    where allocation.business_id = '74747474-7474-4747-8747-74747474a001'
      and pool.expense_item_id = '74747474-7474-4747-8747-74747474e005'
  ) then
    raise exception 'Fixed overhead entered automatic Lifetime Contribution Profit';
  end if;
end;
$$;

reset role;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency,
  normalized_outcome
)
values (
  '74747474-7474-4747-8747-74747474a001', 'task3-fixture', 'a-feb-refund', gen_random_uuid(),
  'task3-a1@example.test', '2026-02-10', 200, 'refund', 5,
  '74747474-7474-4747-8747-747474740001', '2026-02-10T10:00:00Z',
  '2026-02-10T10:00:00Z', 'USD', 'successful'
);

update public.monthly_periods
set unallocated_refunds = 200
where id = '74747474-7474-4747-8747-74747474f002';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  february_row record;
  current_row record;
begin
  select * into strict february_row
  from public.customer_lifetime_contribution_profit_observations
  where business_id = '74747474-7474-4747-8747-74747474a001'
    and cohort_month = '2026-01-01'::date
    and observation_month = '2026-02-01'::date;

  if february_row.lifetime_net_cash is distinct from 1800
    or february_row.lifetime_attributable_costs is distinct from 450
    or february_row.lifetime_contribution_profit is distinct from 1350
    or february_row.lifetime_contribution_profit_per_customer is distinct from 675
    or february_row.quality_state is distinct from 'estimated' then
    raise exception 'Task 3 historical backdated refund recalculation is wrong';
  end if;

  select * into strict current_row
  from public.customer_lifetime_contribution_profit
  where business_id = '74747474-7474-4747-8747-74747474a001'
    and cohort_month = '2026-01-01'::date;

  if current_row.lifetime_net_cash is distinct from 1800
    or current_row.lifetime_contribution_profit is distinct from 1350
    or current_row.lifetime_contribution_profit_per_customer is distinct from 675 then
    raise exception 'Task 3 current snapshot did not recalculate after backdated refund';
  end if;
end;
$$;

reset role;

insert into public.customer_cohort_cost_allocations (
  business_id, cohort_month, cost_type, amount, attribution_method, note,
  eligibility_confirmed, created_by_user_id, updated_by_user_id
)
values (
  '74747474-7474-4747-8747-74747474a001',
  '2026-01-01',
  'acquisition',
  999,
  'direct_actual',
  'Legacy audit row that must never be added to automatic LCP',
  true,
  '74747474-7474-4747-8747-747474740001',
  '74747474-7474-4747-8747-747474740001'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare result_row record;
begin
  select * into strict result_row
  from public.customer_lifetime_contribution_profit
  where business_id = '74747474-7474-4747-8747-74747474a001'
    and cohort_month = '2026-01-01'::date;

  if result_row.legacy_manual_allocation_count is distinct from 1
    or result_row.quality_state is distinct from 'incomplete'
    or result_row.allocation_complete is not false
    or result_row.lifetime_contribution_profit is not null
    or result_row.lifetime_contribution_profit_per_customer is not null
    or result_row.lifetime_attributable_costs is distinct from 450
    or result_row.acquisition_costs is distinct from 200
    or result_row.uses_explicit_allocation is not false then
    raise exception 'Task 3 legacy manual allocation handling is wrong';
  end if;
end;
$$;

reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare result_row record;
begin
  select * into strict result_row
  from public.customer_lifetime_contribution_profit
  where business_id = '74747474-7474-4747-8747-74747474b002'
    and cohort_month = '2026-01-01'::date;

  if result_row.transaction_history_complete is not true
    or result_row.quality_state is distinct from 'incomplete'
    or result_row.missing_relevant_period_count < 1
    or result_row.lifetime_contribution_profit is not null
    or result_row.allocation_complete is not false then
    raise exception 'Task 3 missing monthly financial period was not treated as incomplete';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_lifetime_contribution_profit_observations
    where business_id = '74747474-7474-4747-8747-74747474b002'
  ) then
    raise exception 'Task 3 owner A can read owner B Lifetime Contribution Profit observations';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_lifetime_contribution_profit_observations
    where business_id = '74747474-7474-4747-8747-74747474a001'
  ) then
    raise exception 'Task 3 owner B can read owner A Lifetime Contribution Profit observations';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474740003","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_lifetime_contribution_profit
    where business_id = '74747474-7474-4747-8747-74747474a001'
  ) then
    raise exception 'Task 3 admin cannot read automatic Lifetime Contribution Profit';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform 1 from public.customer_lifetime_contribution_profit_observations limit 1;
    raise exception 'Anonymous user unexpectedly read Task 3 Lifetime Contribution Profit observations';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.customer_lifetime_contribution_profit limit 1;
    raise exception 'Anonymous user unexpectedly read Task 3 current Lifetime Contribution Profit';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

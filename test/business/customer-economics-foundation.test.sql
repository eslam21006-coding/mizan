begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('71717171-7171-4717-8717-717171710001', 'ce-foundation-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('71717171-7171-4717-8717-717171710002', 'ce-foundation-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('71717171-7171-4717-8717-717171710003', 'ce-foundation-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('71717171-7171-4717-8717-71717171a001', 'CE Foundation A', 'USD', 'Africa/Cairo', '71717171-7171-4717-8717-717171710001', '71717171-7171-4717-8717-71717171c001'),
  ('71717171-7171-4717-8717-71717171b002', 'CE Foundation B', 'USD', 'Africa/Cairo', '71717171-7171-4717-8717-717171710002', '71717171-7171-4717-8717-71717171c002');

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values
  ('71717171-7171-4717-8717-71717171e001', '71717171-7171-4717-8717-71717171a001', 'Sales Team', 'acquisition', 'fixed_monthly', '71717171-7171-4717-8717-71717171d001'),
  ('71717171-7171-4717-8717-71717171e002', '71717171-7171-4717-8717-71717171a001', 'Fulfillment Salary', 'fulfillment', 'fixed_monthly', '71717171-7171-4717-8717-71717171d002'),
  ('71717171-7171-4717-8717-71717171e003', '71717171-7171-4717-8717-71717171a001', 'Processor', 'financial', 'percentage_revenue', '71717171-7171-4717-8717-71717171d003');

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers,
  unallocated_gross_cash_collected, unallocated_refunds
)
values (
  '71717171-7171-4717-8717-71717171f001', '71717171-7171-4717-8717-71717171a001',
  '2026-08-01', 45, 50, 0, 0
);

insert into public.monthly_expense_entries (
  id, business_id, monthly_period_id, expense_item_id, expense_name_snapshot,
  category_snapshot, cost_behavior_snapshot, input_value, customer_count_basis
)
values
  ('71717171-7171-4717-8717-71717171f101', '71717171-7171-4717-8717-71717171a001', '71717171-7171-4717-8717-71717171f001', '71717171-7171-4717-8717-71717171e001', 'Sales Team', 'acquisition', 'fixed_monthly', 4500, null),
  ('71717171-7171-4717-8717-71717171f102', '71717171-7171-4717-8717-71717171a001', '71717171-7171-4717-8717-71717171f001', '71717171-7171-4717-8717-71717171e002', 'Fulfillment Salary', 'fulfillment', 'fixed_monthly', 6000, null),
  ('71717171-7171-4717-8717-71717171f103', '71717171-7171-4717-8717-71717171a001', '71717171-7171-4717-8717-71717171f001', '71717171-7171-4717-8717-71717171e003', 'Processor', 'financial', 'percentage_revenue', null, null);

update public.expense_items
set category = 'overhead', cost_behavior = 'per_customer'
where id = '71717171-7171-4717-8717-71717171e001';

insert into public.customer_cohort_cost_allocations (
  id, business_id, cohort_month, cost_type, amount, attribution_method, note,
  created_by_user_id, updated_by_user_id, eligibility_confirmed
)
values (
  '71717171-7171-4717-8717-71717171f201',
  '71717171-7171-4717-8717-71717171a001',
  '2026-08-01', 'acquisition', 2000, 'explicit_allocation', 'legacy row',
  '71717171-7171-4717-8717-717171710001', '71717171-7171-4717-8717-717171710001', true
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171710001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  acquisition record;
  fixed_fulfillment record;
  missing_processor record;
begin
  select * into acquisition
  from public.customer_economics_expense_foundation
  where authoritative_source_id = '71717171-7171-4717-8717-71717171f101';

  if acquisition.authoritative_source_type <> 'monthly_expense_entry'
     or acquisition.activity_month <> '2026-08-01'::date
     or acquisition.category_snapshot <> 'acquisition'
     or acquisition.cost_behavior_snapshot <> 'fixed_monthly'
     or acquisition.cost_eligibility <> 'eligible'
     or acquisition.default_allocation_driver <> 'new_customers'
     or acquisition.eligibility_reason <> 'ACQUISITION_COST'
     or acquisition.calculation_input_value <> 4500
     or acquisition.calculation_input_state <> 'present' then
    raise exception 'Fixed Acquisition source boundary or historical snapshot is wrong';
  end if;

  select * into fixed_fulfillment
  from public.customer_economics_expense_foundation
  where authoritative_source_id = '71717171-7171-4717-8717-71717171f102';

  if fixed_fulfillment.cost_eligibility <> 'excluded'
     or fixed_fulfillment.default_allocation_driver <> 'none'
     or fixed_fulfillment.eligibility_reason <> 'FIXED_FULFILLMENT' then
    raise exception 'Fixed Fulfillment must be excluded from customer economics';
  end if;

  select * into missing_processor
  from public.customer_economics_expense_foundation
  where authoritative_source_id = '71717171-7171-4717-8717-71717171f103';

  if missing_processor.calculation_input_state <> 'missing'
     or missing_processor.calculation_input_value is not null
     or missing_processor.cost_eligibility <> 'eligible'
     or missing_processor.default_allocation_driver <> 'positive_collected_cash' then
    raise exception 'Missing processor input was not preserved as missing';
  end if;

  if not exists (
    select 1 from public.customer_economics_legacy_manual_allocations
    where id = '71717171-7171-4717-8717-71717171f201'
      and legacy_status = 'legacy_manual_unreconciled'
      and eligible_for_new_engine = false
  ) then
    raise exception 'Legacy manual allocation was not preserved as unreconciled audit data';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171710002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_economics_expense_foundation
    where business_id = '71717171-7171-4717-8717-71717171a001'
  ) then
    raise exception 'Outsider can read another business Customer Economics expense foundation';
  end if;
  if exists (
    select 1 from public.customer_economics_legacy_manual_allocations
    where business_id = '71717171-7171-4717-8717-71717171a001'
  ) then
    raise exception 'Outsider can read another business legacy Customer Economics allocations';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171710003","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_economics_expense_foundation
    where business_id = '71717171-7171-4717-8717-71717171a001'
  ) then
    raise exception 'Admin lost authorized global Customer Economics read access';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform 1 from public.customer_economics_expense_foundation limit 1;
    raise exception 'Anonymous user unexpectedly read Customer Economics expense foundation';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

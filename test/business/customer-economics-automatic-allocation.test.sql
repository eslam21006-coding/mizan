begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('72727272-7272-4727-8727-727272720001', 'task2-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('72727272-7272-4727-8727-727272720002', 'task2-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('72727272-7272-4727-8727-727272720003', 'task2-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('72727272-7272-4727-8727-72727272a001', 'Task 2 Allocation A', 'USD', 'Africa/Cairo', '72727272-7272-4727-8727-727272720001', '72727272-7272-4727-8727-72727272c001'),
  ('72727272-7272-4727-8727-72727272b002', 'Task 2 Allocation B', 'USD', 'Africa/Cairo', '72727272-7272-4727-8727-727272720002', '72727272-7272-4727-8727-72727272c002');

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values
  ('72727272-7272-4727-8727-72727272e001', '72727272-7272-4727-8727-72727272a001', 'Acquisition Fixed', 'acquisition', 'fixed_monthly', '72727272-7272-4727-8727-72727272d001'),
  ('72727272-7272-4727-8727-72727272e002', '72727272-7272-4727-8727-72727272a001', 'Per Paying', 'fulfillment', 'per_customer', '72727272-7272-4727-8727-72727272d002'),
  ('72727272-7272-4727-8727-72727272e003', '72727272-7272-4727-8727-72727272a001', 'Processor', 'financial', 'percentage_revenue', '72727272-7272-4727-8727-72727272d003'),
  ('72727272-7272-4727-8727-72727272e004', '72727272-7272-4727-8727-72727272a001', 'Fixed Fulfillment', 'fulfillment', 'fixed_monthly', '72727272-7272-4727-8727-72727272d004'),
  ('72727272-7272-4727-8727-72727272a005', '72727272-7272-4727-8727-72727272a001', 'Missing Processor', 'financial', 'percentage_revenue', '72727272-7272-4727-8727-72727272d005'),
  ('72727272-7272-4727-8727-72727272a006', '72727272-7272-4727-8727-72727272a001', 'Zero Acquisition', 'acquisition', 'fixed_monthly', '72727272-7272-4727-8727-72727272d006'),
  ('72727272-7272-4727-8727-72727272b003', '72727272-7272-4727-8727-72727272b002', 'Incomplete Acquisition', 'acquisition', 'fixed_monthly', '72727272-7272-4727-8727-72727272d007');

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers,
  unallocated_gross_cash_collected, unallocated_refunds
)
values
  ('72727272-7272-4727-8727-72727272f001', '72727272-7272-4727-8727-72727272a001', '2026-07-01', 0, 0, 0, 0),
  ('72727272-7272-4727-8727-72727272f002', '72727272-7272-4727-8727-72727272a001', '2026-08-01', 45, 45, 4500, 0),
  ('72727272-7272-4727-8727-72727272f003', '72727272-7272-4727-8727-72727272a001', '2026-09-01', 4, 4, 400, 0),
  ('72727272-7272-4727-8727-72727272f004', '72727272-7272-4727-8727-72727272a001', '2026-11-01', 3, 3, 300, 0),
  ('72727272-7272-4727-8727-72727272f005', '72727272-7272-4727-8727-72727272a001', '2026-12-01', 0, 10, 1050, 500),
  ('72727272-7272-4727-8727-72727272f006', '72727272-7272-4727-8727-72727272a001', '2027-01-01', 0, 2, 9000, 0),
  ('72727272-7272-4727-8727-72727272f007', '72727272-7272-4727-8727-72727272a001', '2027-02-01', 0, 1, 20000, 0),
  ('72727272-7272-4727-8727-72727272f008', '72727272-7272-4727-8727-72727272a001', '2027-03-01', 0, 0, 0, 0),
  ('72727272-7272-4727-8727-72727272b004', '72727272-7272-4727-8727-72727272b002', '2026-08-01', 1, 1, 100, 0);

insert into public.monthly_expense_entries (
  id, business_id, monthly_period_id, expense_item_id,
  expense_name_snapshot, category_snapshot, cost_behavior_snapshot,
  input_value, customer_count_basis
)
values
  ('72727272-7272-4727-8727-727272721001', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f001', '72727272-7272-4727-8727-72727272e001', 'Acquisition Fixed', 'acquisition', 'fixed_monthly', 8000, null),
  ('72727272-7272-4727-8727-727272721002', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f002', '72727272-7272-4727-8727-72727272e001', 'Acquisition Fixed', 'acquisition', 'fixed_monthly', 4500, null),
  ('72727272-7272-4727-8727-727272721003', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f002', '72727272-7272-4727-8727-72727272e004', 'Fixed Fulfillment', 'fulfillment', 'fixed_monthly', 1000, null),
  ('72727272-7272-4727-8727-727272721004', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f005', '72727272-7272-4727-8727-72727272e002', 'Per Paying', 'fulfillment', 'per_customer', 100, 'total_paying_customers'),
  ('72727272-7272-4727-8727-727272721005', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f006', '72727272-7272-4727-8727-72727272e003', 'Processor', 'financial', 'percentage_revenue', 0.1, null),
  ('72727272-7272-4727-8727-727272721006', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f007', '72727272-7272-4727-8727-72727272e003', 'Processor', 'financial', 'percentage_revenue', 0.1, null),
  ('72727272-7272-4727-8727-727272721007', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f008', '72727272-7272-4727-8727-72727272a005', 'Missing Processor', 'financial', 'percentage_revenue', null, null),
  ('72727272-7272-4727-8727-727272721008', '72727272-7272-4727-8727-72727272a001', '72727272-7272-4727-8727-72727272f008', '72727272-7272-4727-8727-72727272a006', 'Zero Acquisition', 'acquisition', 'fixed_monthly', 0, null),
  ('72727272-7272-4727-8727-72727272b005', '72727272-7272-4727-8727-72727272b002', '72727272-7272-4727-8727-72727272b004', '72727272-7272-4727-8727-72727272b003', 'Incomplete Acquisition', 'acquisition', 'fixed_monthly', 1000, null);

insert into public.funnel_monthly_periods (id, business_id, month_start, business_ad_spend)
values ('72727272-7272-4727-8727-727272722001', '72727272-7272-4727-8727-72727272a001', '2026-07-01', 8000);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272720001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source('72727272-7272-4727-8727-72727272a001', 'task2-fixture');
reset role;

insert into public.business_transaction_history_status (
  business_id, is_complete, confirmed_at, confirmed_by_user_id
)
values
  ('72727272-7272-4727-8727-72727272a001', true, now(), '72727272-7272-4727-8727-727272720001'),
  ('72727272-7272-4727-8727-72727272b002', false, null, null)
on conflict (business_id) do update set
  is_complete = excluded.is_complete,
  confirmed_at = excluded.confirmed_at,
  confirmed_by_user_id = excluded.confirmed_by_user_id;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
select
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'aug-' || g,
  gen_random_uuid(), 'aug-' || g || '@example.test', '2026-08-05', 100, 'collection', g,
  '72727272-7272-4727-8727-727272720001', '2026-08-05T10:00:00Z', '2026-08-05T10:00:00Z', 'USD', 'successful'
from generate_series(1, 45) as g;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
select
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'sep-' || g,
  gen_random_uuid(), 'sep-' || g || '@example.test', '2026-09-05', 100, 'collection', 100 + g,
  '72727272-7272-4727-8727-727272720001', '2026-09-05T10:00:00Z', '2026-09-05T10:00:00Z', 'USD', 'successful'
from generate_series(1, 4) as g;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
select
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'nov-' || g,
  gen_random_uuid(), 'nov-' || g || '@example.test', '2026-11-05', 100, 'collection', 200 + g,
  '72727272-7272-4727-8727-727272720001', '2026-11-05T10:00:00Z', '2026-11-05T10:00:00Z', 'USD', 'successful'
from generate_series(1, 3) as g;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
select
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'dec-aug-' || g,
  gen_random_uuid(), 'aug-' || g || '@example.test', '2026-12-05', 100, 'collection', 300 + g,
  '72727272-7272-4727-8727-727272720001', '2026-12-05T10:00:00Z', '2026-12-05T10:00:00Z', 'USD', 'successful'
from generate_series(1, 3) as g
union all
select
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'dec-sep-' || g,
  gen_random_uuid(), 'sep-' || g || '@example.test', '2026-12-05', 100, 'collection', 400 + g,
  '72727272-7272-4727-8727-727272720001', '2026-12-05T10:00:00Z', '2026-12-05T10:00:00Z', 'USD', 'successful'
from generate_series(1, 4) as g
union all
select
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'dec-nov-' || g,
  gen_random_uuid(), 'nov-' || g || '@example.test', '2026-12-05', 100, 'collection', 500 + g,
  '72727272-7272-4727-8727-727272720001', '2026-12-05T10:00:00Z', '2026-12-05T10:00:00Z', 'USD', 'successful'
from generate_series(1, 3) as g;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values (
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'dec-aug-repeat', gen_random_uuid(),
  'aug-1@example.test', '2026-12-06', 50, 'collection', 601,
  '72727272-7272-4727-8727-727272720001', '2026-12-06T10:00:00Z', '2026-12-06T10:00:00Z', 'USD', 'successful'
);

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values (
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'dec-refund-only', gen_random_uuid(),
  'refund-only@example.test', '2026-12-07', 500, 'refund', 602,
  '72727272-7272-4727-8727-727272720001', '2026-12-07T10:00:00Z', '2026-12-07T10:00:00Z', 'USD', 'successful'
);

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values
  ('72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'jan-aug', gen_random_uuid(), 'aug-1@example.test', '2027-01-05', 3000, 'collection', 701, '72727272-7272-4727-8727-727272720001', '2027-01-05T10:00:00Z', '2027-01-05T10:00:00Z', 'USD', 'successful'),
  ('72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'jan-sep', gen_random_uuid(), 'sep-1@example.test', '2027-01-05', 6000, 'collection', 702, '72727272-7272-4727-8727-727272720001', '2027-01-05T10:00:00Z', '2027-01-05T10:00:00Z', 'USD', 'successful');

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values (
  '72727272-7272-4727-8727-72727272a001', 'task2-fixture', 'feb-short', gen_random_uuid(),
  'aug-2@example.test', '2027-02-05', 19500, 'collection', 801,
  '72727272-7272-4727-8727-727272720001', '2027-02-05T10:00:00Z', '2027-02-05T10:00:00Z', 'USD', 'successful'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272720001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  result_row record;
begin
  select authoritative_amount, allocated_amount, unallocated_amount, reconciles, allocation_quality_state
  into result_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721002';

  if result_row.authoritative_amount <> 4500
    or result_row.allocated_amount <> 4500
    or result_row.unallocated_amount <> 0
    or result_row.reconciles is not true
    or result_row.allocation_quality_state <> 'estimated' then
    raise exception 'Task 2 same-period acquisition pool failed';
  end if;

  if not exists (
    select 1 from public.customer_economics_cost_allocations
    where authoritative_source_id = '72727272-7272-4727-8727-727272721002'
      and cohort_month = '2026-08-01'::date
      and allocated_amount = 4500
      and allocation_driver = 'new_customers'
      and allocation_provenance = 'deterministic_estimate'
  ) then
    raise exception 'Task 2 acquisition allocation did not roll to August acquisition group';
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.customer_economics_authoritative_cost_pools
      where business_id = '72727272-7272-4727-8727-72727272a001'
        and activity_month = '2026-07-01'::date
        and authoritative_amount = 8000) <> 1 then
    raise exception 'Funnel Ad Spend became a duplicate Customer Economics monetary source';
  end if;
end;
$$;

do $$
declare result_row record;
begin
  select allocated_amount, unallocated_amount, reconciles, allocation_exception_reason
  into result_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721001';

  if result_row.allocated_amount <> 0
    or result_row.unallocated_amount <> 8000
    or result_row.reconciles is not true
    or result_row.allocation_exception_reason <> 'NO_NEW_CUSTOMERS' then
    raise exception 'Zero-new-customer Acquisition cost was not left Unallocated';
  end if;
end;
$$;

do $$
declare
  aug_amount numeric;
  sep_amount numeric;
  nov_amount numeric;
  payer_weight numeric;
begin
  select sum(allocation_weight) into payer_weight
  from public.customer_economics_activity_evidence
  where business_id = '72727272-7272-4727-8727-72727272a001'
    and activity_month = '2026-12-01'::date
    and allocation_driver = 'paying_customers';

  select allocated_amount into aug_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '72727272-7272-4727-8727-727272721004'
    and cohort_month = '2026-08-01'::date;
  select allocated_amount into sep_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '72727272-7272-4727-8727-727272721004'
    and cohort_month = '2026-09-01'::date;
  select allocated_amount into nov_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '72727272-7272-4727-8727-727272721004'
    and cohort_month = '2026-11-01'::date;

  if payer_weight <> 10 or aug_amount <> 300 or sep_amount <> 400 or nov_amount <> 300 then
    raise exception 'Paying Customer allocation or distinct payer counting is wrong';
  end if;
end;
$$;

do $$
declare
  aug_amount numeric;
  sep_amount numeric;
  result_row record;
begin
  select allocated_amount into aug_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '72727272-7272-4727-8727-727272721005'
    and cohort_month = '2026-08-01'::date;
  select allocated_amount into sep_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '72727272-7272-4727-8727-727272721005'
    and cohort_month = '2026-09-01'::date;
  select authoritative_amount, allocated_amount, unallocated_amount, reconciles
  into result_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721005';

  if result_row.authoritative_amount <> 900
    or aug_amount <> 300
    or sep_amount <> 600
    or result_row.allocated_amount <> 900
    or result_row.unallocated_amount <> 0
    or result_row.reconciles is not true then
    raise exception 'Positive-cash weighted allocation failed';
  end if;
end;
$$;

do $$
declare
  coverage_row record;
  cost_row record;
begin
  select coverage_difference, coverage_tolerance, blocking, coverage_state
  into coverage_row
  from public.customer_economics_revenue_coverage
  where business_id = '72727272-7272-4727-8727-72727272a001'
    and activity_month = '2027-02-01'::date;

  select authoritative_amount, allocated_amount, unallocated_amount, allocation_exception_reason, reconciles
  into cost_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721006';

  if coverage_row.coverage_difference <> 500
    or coverage_row.coverage_tolerance <> 20
    or coverage_row.blocking is not true
    or coverage_row.coverage_state <> 'REVENUE_COVERAGE_MISMATCH'
    or cost_row.authoritative_amount <> 2000
    or cost_row.allocated_amount <> 0
    or cost_row.unallocated_amount <> 2000
    or cost_row.allocation_exception_reason <> 'REVENUE_COVERAGE_MISMATCH'
    or cost_row.reconciles is not true then
    raise exception 'Revenue coverage mismatch handling failed';
  end if;
end;
$$;

do $$
declare
  missing_row record;
  zero_row record;
begin
  select authoritative_amount, allocated_amount, unallocated_amount, allocation_quality_state, reconciles
  into missing_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721007';

  select authoritative_amount, allocated_amount, unallocated_amount, allocation_quality_state, reconciles
  into zero_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721008';

  if missing_row.authoritative_amount is not null
    or missing_row.allocated_amount is not null
    or missing_row.unallocated_amount is not null
    or missing_row.allocation_quality_state <> 'incomplete'
    or missing_row.reconciles is not null then
    raise exception 'Missing eligible expense was converted to zero';
  end if;

  if zero_row.authoritative_amount <> 0
    or zero_row.allocated_amount <> 0
    or zero_row.unallocated_amount <> 0
    or zero_row.allocation_quality_state <> 'actual'
    or zero_row.reconciles is not true then
    raise exception 'Explicit zero is not a valid reconciled zero';
  end if;
end;
$$;

do $$
declare result_row record;
begin
  select cost_eligibility, authoritative_amount, allocated_amount, unallocated_amount, reconciles
  into result_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-727272721003';

  if result_row.cost_eligibility <> 'excluded'
    or result_row.authoritative_amount <> 1000
    or result_row.allocated_amount <> 0
    or result_row.unallocated_amount <> 0
    or result_row.reconciles is not null then
    raise exception 'Fixed Fulfillment entered customer economics allocation';
  end if;
end;
$$;

do $$
begin
  if (select quality_state from public.customer_economics_period_quality
      where business_id = '72727272-7272-4727-8727-72727272a001'
        and activity_month = '2026-08-01'::date) <> 'estimated' then
    raise exception 'Healthy automatic allocation period should be Estimated';
  end if;

  if (select quality_state from public.customer_economics_period_quality
      where business_id = '72727272-7272-4727-8727-72727272a001'
        and activity_month = '2027-02-01'::date) <> 'incomplete' then
    raise exception 'Coverage mismatch period should be Incomplete';
  end if;

  if (select quality_state from public.customer_economics_period_quality
      where business_id = '72727272-7272-4727-8727-72727272a001'
        and activity_month = '2027-03-01'::date) <> 'incomplete' then
    raise exception 'Missing eligible cost period should be Incomplete';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272720002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare result_row record;
begin
  select allocated_amount, unallocated_amount, allocation_exception_reason, allocation_quality_state, reconciles
  into result_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '72727272-7272-4727-8727-72727272b005';

  if result_row.allocated_amount <> 0
    or result_row.unallocated_amount <> 1000
    or result_row.allocation_exception_reason <> 'INCOMPLETE_TRANSACTION_HISTORY'
    or result_row.allocation_quality_state <> 'incomplete'
    or result_row.reconciles is not true then
    raise exception 'Incomplete transaction history was treated as trusted allocation evidence';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272720001","role":"authenticated","app_metadata":{"role":"mentee"}}';
do $$
begin
  if exists (
    select 1 from public.customer_economics_cost_pool_reconciliation
    where business_id = '72727272-7272-4727-8727-72727272b002'
  ) then
    raise exception 'Mentee can read another business automatic allocations';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272720002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_economics_cost_pool_reconciliation
    where business_id = '72727272-7272-4727-8727-72727272a001'
  ) then
    raise exception 'Outsider can read Task 2 automatic allocation data';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272720003","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_economics_cost_pool_reconciliation
    where business_id = '72727272-7272-4727-8727-72727272a001'
  ) then
    raise exception 'Admin cannot read authorized global Customer Economics allocations';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform 1 from public.customer_economics_cost_pool_reconciliation limit 1;
    raise exception 'Anonymous user unexpectedly read Task 2 Customer Economics allocation data';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

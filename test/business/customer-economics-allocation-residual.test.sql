begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '73737373-7373-4737-8737-737373730001',
  'task2-residual-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  '73737373-7373-4737-8737-73737373a001',
  'Task 2 Residual Allocation',
  'USD',
  'Africa/Cairo',
  '73737373-7373-4737-8737-737373730001',
  '73737373-7373-4737-8737-73737373c001'
);

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values (
  '73737373-7373-4737-8737-73737373e001',
  '73737373-7373-4737-8737-73737373a001',
  'Residual Processor',
  'financial',
  'percentage_revenue',
  '73737373-7373-4737-8737-73737373d001'
);

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers,
  unallocated_gross_cash_collected, unallocated_refunds
)
values (
  '73737373-7373-4737-8737-73737373f001',
  '73737373-7373-4737-8737-73737373a001',
  '2027-04-01',
  0,
  3,
  1050,
  500
);

insert into public.monthly_expense_entries (
  id, business_id, monthly_period_id, expense_item_id,
  expense_name_snapshot, category_snapshot, cost_behavior_snapshot,
  input_value, customer_count_basis
)
values (
  '73737373-7373-4737-8737-737373731001',
  '73737373-7373-4737-8737-73737373a001',
  '73737373-7373-4737-8737-73737373f001',
  '73737373-7373-4737-8737-73737373e001',
  'Residual Processor',
  'financial',
  'percentage_revenue',
  1,
  null
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"73737373-7373-4737-8737-737373730001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source(
  '73737373-7373-4737-8737-73737373a001',
  'task2-residual'
);
reset role;

insert into public.business_transaction_history_status (
  business_id, is_complete, confirmed_at, confirmed_by_user_id
)
values (
  '73737373-7373-4737-8737-73737373a001',
  true,
  now(),
  '73737373-7373-4737-8737-737373730001'
)
on conflict (business_id) do update set
  is_complete = excluded.is_complete,
  confirmed_at = excluded.confirmed_at,
  confirmed_by_user_id = excluded.confirmed_by_user_id;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency,
  normalized_outcome
)
values
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'acq-jan', gen_random_uuid(),
    'residual-jan@example.test', '2027-01-05', 100, 'collection', 1,
    '73737373-7373-4737-8737-737373730001', '2027-01-05T10:00:00Z',
    '2027-01-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'acq-feb', gen_random_uuid(),
    'residual-feb@example.test', '2027-02-05', 100, 'collection', 2,
    '73737373-7373-4737-8737-737373730001', '2027-02-05T10:00:00Z',
    '2027-02-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'acq-mar', gen_random_uuid(),
    'residual-mar@example.test', '2027-03-05', 100, 'collection', 3,
    '73737373-7373-4737-8737-737373730001', '2027-03-05T10:00:00Z',
    '2027-03-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'apr-jan', gen_random_uuid(),
    'residual-jan@example.test', '2027-04-05', 350, 'collection', 4,
    '73737373-7373-4737-8737-737373730001', '2027-04-05T10:00:00Z',
    '2027-04-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'apr-feb', gen_random_uuid(),
    'residual-feb@example.test', '2027-04-05', 350, 'collection', 5,
    '73737373-7373-4737-8737-737373730001', '2027-04-05T10:00:00Z',
    '2027-04-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'apr-mar', gen_random_uuid(),
    'residual-mar@example.test', '2027-04-05', 350, 'collection', 6,
    '73737373-7373-4737-8737-737373730001', '2027-04-05T10:00:00Z',
    '2027-04-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '73737373-7373-4737-8737-73737373a001', 'task2-residual', 'apr-refund', gen_random_uuid(),
    'residual-jan@example.test', '2027-04-06', 500, 'refund', 7,
    '73737373-7373-4737-8737-737373730001', '2027-04-06T10:00:00Z',
    '2027-04-06T10:00:00Z', 'USD', 'successful'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"73737373-7373-4737-8737-737373730001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  reconciliation_row record;
  allocation_count bigint;
  distinct_amount_count bigint;
  total_allocated numeric;
  january_amount numeric;
  february_amount numeric;
  march_amount numeric;
begin
  select
    authoritative_amount,
    allocated_amount,
    unallocated_amount,
    reconciliation_difference,
    reconciles,
    allocation_quality_state
  into strict reconciliation_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '73737373-7373-4737-8737-737373731001';

  select
    count(*),
    count(distinct allocated_amount),
    sum(allocated_amount)
  into allocation_count, distinct_amount_count, total_allocated
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '73737373-7373-4737-8737-737373731001';

  select allocated_amount into strict january_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '73737373-7373-4737-8737-737373731001'
    and cohort_month = '2027-01-01'::date;

  select allocated_amount into strict february_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '73737373-7373-4737-8737-737373731001'
    and cohort_month = '2027-02-01'::date;

  select allocated_amount into strict march_amount
  from public.customer_economics_cost_allocations
  where authoritative_source_id = '73737373-7373-4737-8737-737373731001'
    and cohort_month = '2027-03-01'::date;

  if reconciliation_row.authoritative_amount is distinct from 550
    or reconciliation_row.allocated_amount is distinct from 550
    or reconciliation_row.unallocated_amount is distinct from 0
    or reconciliation_row.reconciliation_difference is distinct from 0
    or reconciliation_row.reconciles is not true
    or reconciliation_row.allocation_quality_state is distinct from 'estimated'
    or allocation_count is distinct from 3
    or total_allocated is distinct from 550 then
    raise exception 'Residual allocation failed exact reconciliation';
  end if;

  if distinct_amount_count is distinct from 2
    or january_amount is distinct from february_amount
    or march_amount is not distinct from january_amount then
    raise exception 'Residual allocation did not land on the final-ranked March cohort';
  end if;
end;
$$;

rollback;

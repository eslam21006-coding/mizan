begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  'b02d1111-1111-4111-8111-111111111111',
  'b02-invariance-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'B02 Invariance Business',
  'EGP',
  'Africa/Cairo',
  'b02d1111-1111-4111-8111-111111111111',
  'b02d5555-5555-4555-8555-555555555555'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b02d1111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values
  (
    'b02d0000-0000-4000-8000-000000000001',
    'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Historical Expense',
    'overhead',
    'fixed_monthly',
    'b02d1000-0000-4000-8000-000000000001'
  ),
  (
    'b02d0000-0000-4000-8000-000000000002',
    'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Mutable Expense',
    'fulfillment',
    'per_customer',
    'b02d1000-0000-4000-8000-000000000002'
  ),
  (
    'b02d0000-0000-4000-8000-000000000003',
    'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Delete Me',
    'financial',
    'fixed_monthly',
    'b02d1000-0000-4000-8000-000000000003'
  );

do $$
begin
  if (
    select expense_setup_reviewed_at
    from public.businesses
    where id = 'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) is not null then
    raise exception 'creating expenses unexpectedly confirmed expense setup';
  end if;
end $$;

reset role;

insert into public.monthly_periods (
  id,
  business_id,
  month_start,
  new_customers,
  total_paying_customers,
  unallocated_gross_cash_collected,
  unallocated_refunds,
  adjustment_note
)
values (
  'b02d2000-0000-4000-8000-000000000001',
  'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '2026-09-01',
  2,
  3,
  1000,
  100,
  'B02 invariant snapshot'
);

insert into public.monthly_expense_entries (
  id,
  business_id,
  monthly_period_id,
  expense_item_id,
  expense_name_snapshot,
  category_snapshot,
  cost_behavior_snapshot,
  input_value,
  customer_count_basis
)
values (
  'b02d3000-0000-4000-8000-000000000001',
  'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'b02d2000-0000-4000-8000-000000000001',
  'b02d0000-0000-4000-8000-000000000001',
  'Historical Expense',
  'overhead',
  'fixed_monthly',
  250,
  null
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b02d1111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"mentee"}}';

update public.businesses
set expense_setup_reviewed_at = '2026-09-28T08:20:00Z'
where id = 'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

update public.expense_items
set name = 'Mutable Expense Updated',
    is_active = false
where id = 'b02d0000-0000-4000-8000-000000000002';

delete from public.expense_items
where id = 'b02d0000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (
    select 1
    from public.businesses
    where id = 'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and expense_setup_reviewed_at = '2026-09-28T08:20:00Z'::timestamptz
  ) then
    raise exception 'expense mutation reset or altered reviewed state';
  end if;

  if not exists (
    select 1
    from public.expense_items
    where id = 'b02d0000-0000-4000-8000-000000000002'
      and name = 'Mutable Expense Updated'
      and is_active = false
  ) then
    raise exception 'expense update fixture did not persist';
  end if;

  if exists (
    select 1
    from public.expense_items
    where id = 'b02d0000-0000-4000-8000-000000000003'
  ) then
    raise exception 'unused expense delete fixture did not persist';
  end if;
end $$;

update public.businesses
set expense_setup_reviewed_at = '2026-09-28T08:30:00Z'
where id = 'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where id = 'b02d2000-0000-4000-8000-000000000001'
      and business_id = 'b02daaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and month_start = '2026-09-01'
      and new_customers = 2
      and total_paying_customers = 3
      and unallocated_gross_cash_collected = 1000
      and unallocated_refunds = 100
      and adjustment_note = 'B02 invariant snapshot'
  ) then
    raise exception 'review-state update mutated monthly period financial inputs';
  end if;

  if not exists (
    select 1
    from public.monthly_expense_entries
    where id = 'b02d3000-0000-4000-8000-000000000001'
      and expense_item_id = 'b02d0000-0000-4000-8000-000000000001'
      and expense_name_snapshot = 'Historical Expense'
      and category_snapshot = 'overhead'
      and cost_behavior_snapshot = 'fixed_monthly'
      and input_value = 250
      and customer_count_basis is null
  ) then
    raise exception 'review-state update mutated historical expense data';
  end if;
end $$;

rollback;

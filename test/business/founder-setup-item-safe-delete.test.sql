begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('05111111-1111-4111-8111-111111111111', 'safe-delete-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('05222222-2222-4222-8222-222222222222', 'safe-delete-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('05333333-3333-4333-8333-333333333333', 'safe-delete-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('05444444-4444-4444-8444-444444444444', 'safe-delete-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Safe Delete Business A', 'USD', 'Africa/Cairo', '05111111-1111-4111-8111-111111111111', '051aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('05bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Safe Delete Business B', 'USD', 'Africa/Cairo', '05222222-2222-4222-8222-222222222222', '052bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '05333333-3333-4333-8333-333333333333', 'member');

insert into public.revenue_streams (id, business_id, name, stream_type, creation_request_id)
values
  ('05100000-0000-4000-8000-000000000001', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner Unused Revenue', 'front_end', '05110000-0000-4000-8000-000000000001'),
  ('05100000-0000-4000-8000-000000000002', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Member Protected Revenue', 'backend', '05110000-0000-4000-8000-000000000002'),
  ('05100000-0000-4000-8000-000000000003', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Historical Revenue', 'front_end', '05110000-0000-4000-8000-000000000003'),
  ('05200000-0000-4000-8000-000000000001', '05bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Admin Delete Revenue', 'backend', '05210000-0000-4000-8000-000000000001');

insert into public.expense_items (id, business_id, name, category, cost_behavior, creation_request_id)
values
  ('05300000-0000-4000-8000-000000000001', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner Unused Expense', 'overhead', 'fixed_monthly', '05310000-0000-4000-8000-000000000001'),
  ('05300000-0000-4000-8000-000000000002', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Member Protected Expense', 'acquisition', 'per_customer', '05310000-0000-4000-8000-000000000002'),
  ('05300000-0000-4000-8000-000000000003', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Historical Expense', 'financial', 'fixed_monthly', '05310000-0000-4000-8000-000000000003'),
  ('05400000-0000-4000-8000-000000000001', '05bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Admin Delete Expense', 'fulfillment', 'fixed_monthly', '05410000-0000-4000-8000-000000000001');

insert into public.monthly_periods (id, business_id, month_start, new_customers, total_paying_customers)
values ('05500000-0000-4000-8000-000000000001', '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-08-01', 1, 1);

insert into public.monthly_revenue_entries (
  business_id, monthly_period_id, revenue_stream_id, stream_name_snapshot, stream_type_snapshot, gross_cash_collected, refunds
)
values (
  '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '05500000-0000-4000-8000-000000000001',
  '05100000-0000-4000-8000-000000000003',
  'Historical Revenue',
  'front_end',
  100,
  0
);

insert into public.monthly_expense_entries (
  business_id, monthly_period_id, expense_item_id, expense_name_snapshot, category_snapshot, cost_behavior_snapshot, input_value, customer_count_basis
)
values (
  '05aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '05500000-0000-4000-8000-000000000001',
  '05300000-0000-4000-8000-000000000003',
  'Historical Expense',
  'financial',
  'fixed_monthly',
  25,
  null
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"05111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"mentee"}}';

delete from public.revenue_streams
where id = '05100000-0000-4000-8000-000000000001';

delete from public.expense_items
where id = '05300000-0000-4000-8000-000000000001';

do $$
declare
  affected integer;
begin
  if exists (select 1 from public.revenue_streams where id = '05100000-0000-4000-8000-000000000001') then
    raise exception 'owner could not delete own unused revenue stream';
  end if;
  if exists (select 1 from public.expense_items where id = '05300000-0000-4000-8000-000000000001') then
    raise exception 'owner could not delete own unused expense item';
  end if;

  delete from public.revenue_streams where id = '05200000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A deleted owner B revenue stream';
  end if;

  delete from public.expense_items where id = '05400000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A deleted owner B expense item';
  end if;

  begin
    delete from public.revenue_streams where id = '05100000-0000-4000-8000-000000000003';
    set constraints monthly_revenue_entries_stream_business_fk immediate;
    raise exception 'historical revenue stream delete unexpectedly succeeded';
  exception when foreign_key_violation then
    set constraints monthly_revenue_entries_stream_business_fk deferred;
  end;

  begin
    delete from public.expense_items where id = '05300000-0000-4000-8000-000000000003';
    set constraints monthly_expense_entries_expense_business_fk immediate;
    raise exception 'historical expense item delete unexpectedly succeeded';
  exception when foreign_key_violation then
    set constraints monthly_expense_entries_expense_business_fk deferred;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"05333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  delete from public.revenue_streams where id = '05100000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'read-only member deleted a revenue stream';
  end if;

  delete from public.expense_items where id = '05300000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'read-only member deleted an expense item';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"05444444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"role":"admin"}}';

delete from public.revenue_streams where id = '05200000-0000-4000-8000-000000000001';
delete from public.expense_items where id = '05400000-0000-4000-8000-000000000001';

do $$
begin
  if exists (select 1 from public.revenue_streams where id = '05200000-0000-4000-8000-000000000001') then
    raise exception 'admin could not delete unused revenue stream';
  end if;
  if exists (select 1 from public.expense_items where id = '05400000-0000-4000-8000-000000000001') then
    raise exception 'admin could not delete unused expense item';
  end if;
end $$;

set constraints all immediate;
rollback;

begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('a8000000-0000-4000-8000-000000000001', 'cascade-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('a8000000-0000-4000-8000-000000000002', 'cascade-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('a8000000-0000-4000-8000-000000000003', 'cascade-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  (
    'b8000000-0000-4000-8000-000000000001',
    'Rich business to delete',
    'USD',
    'Africa/Cairo',
    'a8000000-0000-4000-8000-000000000001',
    'c8000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000002',
    'Member cannot delete',
    'USD',
    'Africa/Cairo',
    'a8000000-0000-4000-8000-000000000001',
    'c8000000-0000-4000-8000-000000000002'
  ),
  (
    'b8000000-0000-4000-8000-000000000003',
    'Admin can delete',
    'USD',
    'Africa/Cairo',
    'a8000000-0000-4000-8000-000000000001',
    'c8000000-0000-4000-8000-000000000003'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'b8000000-0000-4000-8000-000000000002',
  'a8000000-0000-4000-8000-000000000002',
  'member'
);

insert into public.revenue_streams (id, business_id, name, stream_type, creation_request_id)
values (
  'c8100000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'Front End',
  'front_end',
  'c8100000-0000-4000-8000-000000000002'
);

insert into public.expense_items (id, business_id, name, category, cost_behavior, creation_request_id)
values (
  'd8100000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'Variable fulfillment',
  'fulfillment',
  'per_customer',
  'd8100000-0000-4000-8000-000000000002'
);

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers
) values (
  'e8100000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  '2026-08-01',
  1,
  1
);

insert into public.monthly_revenue_entries (
  id,
  business_id,
  monthly_period_id,
  revenue_stream_id,
  stream_name_snapshot,
  stream_type_snapshot,
  gross_cash_collected,
  refunds
) values (
  'f8100000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000001',
  'c8100000-0000-4000-8000-000000000001',
  'Front End',
  'front_end',
  100,
  0
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
) values (
  'a8110000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000001',
  'd8100000-0000-4000-8000-000000000001',
  'Variable fulfillment',
  'fulfillment',
  'per_customer',
  10,
  'new_customers'
);

insert into public.monthly_front_end_expense_allocations (
  id,
  business_id,
  monthly_period_id,
  monthly_expense_entry_id,
  expense_item_id,
  expense_name_snapshot,
  cost_behavior_snapshot,
  allocated_amount
) values (
  'a8120000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000001',
  'a8110000-0000-4000-8000-000000000001',
  'd8100000-0000-4000-8000-000000000001',
  'Variable fulfillment',
  'per_customer',
  5
);

insert into public.funnels (id, business_id, name, funnel_type, creation_request_id)
values (
  'a8200000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'Main funnel',
  'lead_gen',
  'a8200000-0000-4000-8000-000000000002'
);

insert into public.funnel_monthly_periods (id, business_id, month_start, business_ad_spend)
values (
  'a8210000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  '2026-08-01',
  20
);

insert into public.funnel_monthly_entries (
  id,
  business_id,
  funnel_monthly_period_id,
  funnel_id,
  funnel_name_snapshot,
  funnel_type_snapshot,
  ad_spend,
  leads,
  new_customers
) values (
  'a8220000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'a8210000-0000-4000-8000-000000000001',
  'a8200000-0000-4000-8000-000000000001',
  'Main funnel',
  'lead_gen',
  20,
  4,
  1
);

insert into public.customer_transaction_sources (
  id, business_id, source, created_by_user_id
) values (
  'a8300000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'test-gateway',
  'a8000000-0000-4000-8000-000000000001'
);

insert into public.customer_transactions (
  id,
  business_id,
  source,
  source_transaction_id,
  import_row_token,
  customer_email,
  transaction_date,
  source_transaction_at,
  transaction_at,
  amount_collected,
  transaction_type,
  normalized_outcome,
  currency,
  source_row_number,
  imported_by_user_id,
  revenue_stream_id,
  revenue_stream_name_snapshot,
  revenue_stream_type_snapshot
) values (
  'a8310000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'test-gateway',
  'tx-1',
  'a8310000-0000-4000-8000-000000000002',
  'customer@example.test',
  '2026-08-15',
  '2026-08-15',
  '2026-08-15T00:00:00+00',
  100,
  'collection',
  'successful',
  'USD',
  1,
  'a8000000-0000-4000-8000-000000000001',
  'c8100000-0000-4000-8000-000000000001',
  'Front End',
  'front_end'
);

insert into public.customer_cohort_cost_allocations (
  id,
  business_id,
  cohort_month,
  cost_type,
  amount,
  attribution_method,
  created_by_user_id,
  updated_by_user_id
) values (
  'a8400000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  '2026-08-01',
  'acquisition',
  20,
  'direct_actual',
  'a8000000-0000-4000-8000-000000000001',
  'a8000000-0000-4000-8000-000000000001'
);

insert into public.simulator_scenarios (
  id, business_id, name, creation_request_id
) values (
  'a8500000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'Delete me scenario',
  'a8500000-0000-4000-8000-000000000002'
);

insert into public.simulator_scenario_overrides (
  business_id, scenario_id, override_key, override_value
) values (
  'b8000000-0000-4000-8000-000000000001',
  'a8500000-0000-4000-8000-000000000001',
  'ad_spend',
  50
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.delete_business_confirmed(
      'b8000000-0000-4000-8000-000000000001',
      'حذف البزنس'
    );
    raise exception 'non-exact confirmation unexpectedly deleted the business';
  exception
    when invalid_parameter_value then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a8000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.delete_business_confirmed(
      'b8000000-0000-4000-8000-000000000002',
      'Delete'
    );
    raise exception 'read-only member deleted a business';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if public.delete_business_confirmed(
    'b8000000-0000-4000-8000-000000000001',
    'حذف'
  ) is distinct from true then
    raise exception 'owner confirmed deletion did not report success';
  end if;
end $$;

reset role;

do $$
begin
  if exists (select 1 from public.businesses where id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'business survived confirmed deletion';
  end if;
  if exists (select 1 from public.monthly_periods where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'monthly history survived confirmed deletion';
  end if;
  if exists (select 1 from public.monthly_revenue_entries where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'monthly revenue history survived confirmed deletion';
  end if;
  if exists (select 1 from public.monthly_expense_entries where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'monthly expense history survived confirmed deletion';
  end if;
  if exists (select 1 from public.monthly_front_end_expense_allocations where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'front-end allocations survived confirmed deletion';
  end if;
  if exists (select 1 from public.funnels where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'funnels survived confirmed deletion';
  end if;
  if exists (select 1 from public.funnel_monthly_periods where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'funnel monthly history survived confirmed deletion';
  end if;
  if exists (select 1 from public.customer_transactions where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'transactions survived confirmed deletion';
  end if;
  if exists (select 1 from public.customer_transaction_sources where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'transaction sources survived confirmed deletion';
  end if;
  if exists (select 1 from public.customer_cohort_cost_allocations where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'cohort costs survived confirmed deletion';
  end if;
  if exists (select 1 from public.simulator_scenarios where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'simulator scenarios survived confirmed deletion';
  end if;
  if exists (select 1 from public.revenue_streams where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'revenue streams survived confirmed deletion';
  end if;
  if exists (select 1 from public.expense_items where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'expense items survived confirmed deletion';
  end if;
  if exists (select 1 from public.business_memberships where business_id = 'b8000000-0000-4000-8000-000000000001') then
    raise exception 'business memberships survived confirmed deletion';
  end if;

  if not exists (select 1 from public.businesses where id = 'b8000000-0000-4000-8000-000000000002') then
    raise exception 'member-denied business disappeared';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a8000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if public.delete_business_confirmed(
    'b8000000-0000-4000-8000-000000000003',
    'Delete'
  ) is distinct from true then
    raise exception 'admin confirmed deletion did not report success';
  end if;
end $$;

reset role;

do $$
begin
  if exists (select 1 from public.businesses where id = 'b8000000-0000-4000-8000-000000000003') then
    raise exception 'admin target business survived confirmed deletion';
  end if;
end $$;

rollback;

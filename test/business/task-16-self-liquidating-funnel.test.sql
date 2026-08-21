begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('16161616-1616-4616-8616-161616161616', 'task16-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('26262626-2626-4626-8626-262626262626', 'task16-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('36363636-3636-4636-8636-363636363636', 'task16-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('46464646-4646-4646-8646-464646464646', 'task16-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('a1616161-1616-4616-8616-161616161616', 'Task 16 Business A', 'EGP', 'Africa/Cairo', '16161616-1616-4616-8616-161616161616', '51616161-1616-4616-8616-161616161616'),
  ('b2626262-2626-4626-8626-262626262626', 'Task 16 Business B', 'SAR', 'Asia/Riyadh', '26262626-2626-4626-8626-262626262626', '62626262-2626-4626-8626-262626262626');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('a1616161-1616-4616-8616-161616161616', '36363636-3636-4636-8636-363636363636', 'member');

insert into public.revenue_streams (id, business_id, name, stream_type, creation_request_id)
values
  ('71616161-1616-4616-8616-161616161611', 'a1616161-1616-4616-8616-161616161616', 'Front Offer', 'front_end', '81616161-1616-4616-8616-161616161611'),
  ('71616161-1616-4616-8616-161616161612', 'a1616161-1616-4616-8616-161616161616', 'Backend Offer', 'backend', '81616161-1616-4616-8616-161616161612'),
  ('71616161-1616-4616-8616-161616161613', 'a1616161-1616-4616-8616-161616161616', 'Other Income', 'other', '81616161-1616-4616-8616-161616161613'),
  ('72626262-2626-4626-8626-262626262621', 'b2626262-2626-4626-8626-262626262626', 'B Front Offer', 'front_end', '82626262-2626-4626-8626-262626262621');

insert into public.expense_items (id, business_id, name, category, cost_behavior, creation_request_id)
values
  ('91616161-1616-4616-8616-161616161611', 'a1616161-1616-4616-8616-161616161616', 'Variable Per Customer', 'fulfillment', 'per_customer', 'a1616161-1616-4616-8616-161616161611'),
  ('91616161-1616-4616-8616-161616161612', 'a1616161-1616-4616-8616-161616161616', 'Variable Percent', 'financial', 'percentage_revenue', 'a1616161-1616-4616-8616-161616161612'),
  ('91616161-1616-4616-8616-161616161613', 'a1616161-1616-4616-8616-161616161616', 'Fixed Cost', 'overhead', 'fixed_monthly', 'a1616161-1616-4616-8616-161616161613'),
  ('92626262-2626-4626-8626-262626262621', 'b2626262-2626-4626-8626-262626262626', 'B Variable', 'fulfillment', 'per_customer', 'b2626262-2626-4626-8626-262626262621');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"16161616-1616-4616-8616-161616161616","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  'a1616161-1616-4616-8616-161616161616',
  '2026-05-01',
  10,
  20,
  0,
  0,
  null,
  '[
    {"revenue_stream_id":"71616161-1616-4616-8616-161616161611","gross_cash_collected":"2000","refunds":"100"},
    {"revenue_stream_id":"71616161-1616-4616-8616-161616161612","gross_cash_collected":"500","refunds":"0"},
    {"revenue_stream_id":"71616161-1616-4616-8616-161616161613","gross_cash_collected":"300","refunds":"0"}
  ]'::jsonb,
  '[
    {"expense_item_id":"91616161-1616-4616-8616-161616161611","display_value":"20","customer_count_basis":"new_customers"},
    {"expense_item_id":"91616161-1616-4616-8616-161616161612","display_value":"10","customer_count_basis":null},
    {"expense_item_id":"91616161-1616-4616-8616-161616161613","display_value":"100","customer_count_basis":null}
  ]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_revenue_entries
    where business_id = 'a1616161-1616-4616-8616-161616161616'
      and stream_type_snapshot = 'other'
      and stream_name_snapshot = 'Other Income'
  ) then
    raise exception 'Other revenue stream type was not preserved in monthly history';
  end if;
end $$;

select public.save_front_end_expense_allocations(
  'a1616161-1616-4616-8616-161616161616',
  '2026-05-01',
  jsonb_build_array(
    jsonb_build_object(
      'monthly_expense_entry_id', (
        select id from public.monthly_expense_entries
        where business_id = 'a1616161-1616-4616-8616-161616161616'
          and expense_item_id = '91616161-1616-4616-8616-161616161611'
      ),
      'allocated_amount', '150'
    ),
    jsonb_build_object(
      'monthly_expense_entry_id', (
        select id from public.monthly_expense_entries
        where business_id = 'a1616161-1616-4616-8616-161616161616'
          and expense_item_id = '91616161-1616-4616-8616-161616161612'
      ),
      'allocated_amount', '200'
    )
  )
);

do $$
begin
  if (select count(*) from public.monthly_front_end_expense_allocations) <> 2 then
    raise exception 'owner allocations did not persist';
  end if;

  if not exists (
    select 1
    from public.monthly_front_end_expense_allocations
    where business_id = 'a1616161-1616-4616-8616-161616161616'
      and expense_item_id = '91616161-1616-4616-8616-161616161611'
      and expense_name_snapshot = 'Variable Per Customer'
      and cost_behavior_snapshot = 'per_customer'
      and allocated_amount = 150
  ) then
    raise exception 'per-customer Front-End allocation or snapshots are incorrect';
  end if;

  begin
    insert into public.monthly_front_end_expense_allocations (
      business_id, monthly_period_id, monthly_expense_entry_id, expense_item_id,
      expense_name_snapshot, cost_behavior_snapshot, allocated_amount
    )
    select
      business_id, monthly_period_id, id, expense_item_id,
      expense_name_snapshot, cost_behavior_snapshot, 1
    from public.monthly_expense_entries
    where business_id = 'a1616161-1616-4616-8616-161616161616'
      and expense_item_id = '91616161-1616-4616-8616-161616161613';
    raise exception 'authenticated owner directly inserted Front-End allocation';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.save_front_end_expense_allocations(
      'a1616161-1616-4616-8616-161616161616',
      '2026-05-01',
      jsonb_build_array(jsonb_build_object(
        'monthly_expense_entry_id', (
          select id from public.monthly_expense_entries
          where business_id = 'a1616161-1616-4616-8616-161616161616'
            and expense_item_id = '91616161-1616-4616-8616-161616161611'
        ),
        'allocated_amount', '201'
      ))
    );
    raise exception 'allocation exceeded calculated per-customer expense amount';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_front_end_expense_allocations(
      'a1616161-1616-4616-8616-161616161616',
      '2026-05-01',
      jsonb_build_array(jsonb_build_object(
        'monthly_expense_entry_id', (
          select id from public.monthly_expense_entries
          where business_id = 'a1616161-1616-4616-8616-161616161616'
            and expense_item_id = '91616161-1616-4616-8616-161616161613'
        ),
        'allocated_amount', '10'
      ))
    );
    raise exception 'fixed monthly expense was allocated to Front-End';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_front_end_expense_allocations(
      'b2626262-2626-4626-8626-262626262626',
      '2026-05-01',
      '[]'::jsonb
    );
    raise exception 'owner A managed owner B Front-End allocations';
  exception when insufficient_privilege then
    null;
  end;
end $$;

update public.expense_items
set name = 'Renamed Variable Later'
where id = '91616161-1616-4616-8616-161616161611';

select public.save_front_end_expense_allocations(
  'a1616161-1616-4616-8616-161616161616',
  '2026-05-01',
  jsonb_build_array(jsonb_build_object(
    'monthly_expense_entry_id', (
      select id from public.monthly_expense_entries
      where business_id = 'a1616161-1616-4616-8616-161616161616'
        and expense_item_id = '91616161-1616-4616-8616-161616161611'
    ),
    'allocated_amount', '100'
  ))
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_front_end_expense_allocations
    where expense_item_id = '91616161-1616-4616-8616-161616161611'
      and expense_name_snapshot = 'Variable Per Customer'
      and allocated_amount = 100
  ) then
    raise exception 'historical allocation snapshot was rewritten after expense rename';
  end if;
end $$;

select public.save_front_end_expense_allocations(
  'a1616161-1616-4616-8616-161616161616',
  '2026-05-01',
  jsonb_build_array(jsonb_build_object(
    'monthly_expense_entry_id', (
      select id from public.monthly_expense_entries
      where business_id = 'a1616161-1616-4616-8616-161616161616'
        and expense_item_id = '91616161-1616-4616-8616-161616161612'
    ),
    'allocated_amount', null
  ))
);

do $$
begin
  if exists (
    select 1
    from public.monthly_front_end_expense_allocations
    where expense_item_id = '91616161-1616-4616-8616-161616161612'
  ) then
    raise exception 'blank allocation did not restore the unknown/missing state';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"26262626-2626-4626-8626-262626262626","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1
    from public.monthly_front_end_expense_allocations
    where business_id = 'a1616161-1616-4616-8616-161616161616'
  ) then
    raise exception 'unrelated mentee read owner A Front-End allocations';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"36363636-3636-4636-8636-363636363636","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.monthly_front_end_expense_allocations) <> 1 then
    raise exception 'business member could not read Front-End allocations';
  end if;

  begin
    perform public.save_front_end_expense_allocations(
      'a1616161-1616-4616-8616-161616161616',
      '2026-05-01',
      '[]'::jsonb
    );
    raise exception 'read-only member changed Front-End allocations';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"46464646-4646-4646-8646-464646464646","role":"authenticated","app_metadata":{"role":"admin"}}';

select public.save_monthly_actuals(
  'b2626262-2626-4626-8626-262626262626',
  '2026-05-01',
  2,
  2,
  0,
  0,
  null,
  '[{"revenue_stream_id":"72626262-2626-4626-8626-262626262621","gross_cash_collected":"500","refunds":"0"}]'::jsonb,
  '[{"expense_item_id":"92626262-2626-4626-8626-262626262621","display_value":"50","customer_count_basis":"new_customers"}]'::jsonb
);

select public.save_front_end_expense_allocations(
  'b2626262-2626-4626-8626-262626262626',
  '2026-05-01',
  jsonb_build_array(jsonb_build_object(
    'monthly_expense_entry_id', (
      select id from public.monthly_expense_entries
      where business_id = 'b2626262-2626-4626-8626-262626262626'
    ),
    'allocated_amount', '100'
  ))
);

do $$
begin
  if not exists (
    select 1 from public.monthly_front_end_expense_allocations
    where business_id = 'b2626262-2626-4626-8626-262626262626'
      and allocated_amount = 100
  ) then
    raise exception 'admin could not manage another business Front-End allocation';
  end if;
end $$;

reset role;

do $$
begin
  begin
    update public.monthly_front_end_expense_allocations
    set expense_name_snapshot = 'Corrupted'
    where business_id = 'a1616161-1616-4616-8616-161616161616';
    raise exception 'Front-End allocation historical snapshot was mutable';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local role anon;

do $$
begin
  begin
    perform 1 from public.monthly_front_end_expense_allocations;
    raise exception 'anon read Front-End allocations';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.save_front_end_expense_allocations(
      'a1616161-1616-4616-8616-161616161616',
      '2026-05-01',
      '[]'::jsonb
    );
    raise exception 'anon executed Front-End allocation RPC';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
rollback;

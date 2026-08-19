begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('18181818-1818-4818-8818-181818181818', 'task8-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('28282828-2828-4828-8828-282828282828', 'task8-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('38383838-3838-4838-8838-383838383838', 'task8-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('48484848-4848-4848-8848-484848484848', 'task8-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  (
    'a8181818-1818-4818-8818-181818181818', 'Task 8 Business A', 'EGP', 'Africa/Cairo',
    '18181818-1818-4818-8818-181818181818', '58181818-1818-4818-8818-181818181818'
  ),
  (
    'b8282828-2828-4828-8828-282828282828', 'Task 8 Business B', 'SAR', 'Asia/Riyadh',
    '28282828-2828-4828-8828-282828282828', '68282828-2828-4828-8828-282828282828'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values ('a8181818-1818-4818-8818-181818181818', '38383838-3838-4838-8838-383838383838', 'member');

insert into public.revenue_streams (
  id, business_id, name, stream_type, creation_request_id
) values
  (
    '81818181-1818-4818-8818-181818181811', 'a8181818-1818-4818-8818-181818181818',
    'Front End A', 'front_end', '91818181-1818-4818-8818-181818181811'
  ),
  (
    '81818181-1818-4818-8818-181818181812', 'a8181818-1818-4818-8818-181818181818',
    'Backend A', 'backend', '91818181-1818-4818-8818-181818181812'
  ),
  (
    '82828282-2828-4828-8828-282828282821', 'b8282828-2828-4828-8828-282828282828',
    'Business B Revenue', 'front_end', '92828282-2828-4828-8828-282828282821'
  );

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
) values
  (
    '81818181-1818-4818-8818-181818181831', 'a8181818-1818-4818-8818-181818181818',
    'Ad Spend', 'acquisition', 'fixed_monthly', '93818181-1818-4818-8818-181818181831'
  ),
  (
    '81818181-1818-4818-8818-181818181832', 'a8181818-1818-4818-8818-181818181818',
    'Certificates', 'fulfillment', 'per_customer', '93818181-1818-4818-8818-181818181832'
  ),
  (
    '81818181-1818-4818-8818-181818181833', 'a8181818-1818-4818-8818-181818181818',
    'Processor Fees', 'financial', 'percentage_revenue', '93818181-1818-4818-8818-181818181833'
  ),
  (
    '82828282-2828-4828-8828-282828282831', 'b8282828-2828-4828-8828-282828282828',
    'Business B Cost', 'overhead', 'fixed_monthly', '94828282-2828-4828-8828-282828282831'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"18181818-1818-4818-8818-181818181818","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  'a8181818-1818-4818-8818-181818181818',
  '2026-01-01',
  10,
  15,
  500,
  100,
  'January unallocated cash',
  '[
    {"revenue_stream_id":"81818181-1818-4818-8818-181818181811","gross_cash_collected":"10000","refunds":"500"},
    {"revenue_stream_id":"81818181-1818-4818-8818-181818181812","gross_cash_collected":"4000","refunds":"0"}
  ]'::jsonb,
  '[
    {"expense_item_id":"81818181-1818-4818-8818-181818181831","display_value":"2000","customer_count_basis":null},
    {"expense_item_id":"81818181-1818-4818-8818-181818181832","display_value":"20","customer_count_basis":"total_paying_customers"},
    {"expense_item_id":"81818181-1818-4818-8818-181818181833","display_value":"3.5","customer_count_basis":null}
  ]'::jsonb
);

do $$
declare
  january_id uuid;
begin
  select id into january_id from public.monthly_periods
  where business_id = 'a8181818-1818-4818-8818-181818181818' and month_start = '2026-01-01';

  if january_id is null then raise exception 'January period was not saved'; end if;
  if not exists (
    select 1 from public.monthly_periods
    where id = january_id
      and new_customers = 10
      and total_paying_customers = 15
      and unallocated_gross_cash_collected = 500
      and unallocated_refunds = 100
  ) then raise exception 'January period inputs are incorrect'; end if;

  if not exists (
    select 1 from public.monthly_revenue_entries
    where monthly_period_id = january_id
      and revenue_stream_id = '81818181-1818-4818-8818-181818181811'
      and gross_cash_collected = 10000
      and refunds = 500
      and stream_type_snapshot = 'front_end'
      and stream_name_snapshot = 'Front End A'
  ) then raise exception 'January revenue snapshot is incorrect'; end if;

  if not exists (
    select 1 from public.monthly_expense_entries
    where monthly_period_id = january_id
      and expense_item_id = '81818181-1818-4818-8818-181818181832'
      and input_value = 20
      and customer_count_basis = 'total_paying_customers'
      and cost_behavior_snapshot = 'per_customer'
  ) then raise exception 'per-customer input or basis is incorrect'; end if;

  if not exists (
    select 1 from public.monthly_expense_entries
    where monthly_period_id = january_id
      and expense_item_id = '81818181-1818-4818-8818-181818181833'
      and input_value = 0.035
      and cost_behavior_snapshot = 'percentage_revenue'
  ) then raise exception 'percentage input was not stored as a decimal rate'; end if;
end $$;

select public.save_monthly_actuals(
  'a8181818-1818-4818-8818-181818181818',
  '2026-02-01',
  0,
  0,
  0,
  0,
  null,
  '[
    {"revenue_stream_id":"81818181-1818-4818-8818-181818181811","gross_cash_collected":"0","refunds":"0"},
    {"revenue_stream_id":"81818181-1818-4818-8818-181818181812","gross_cash_collected":null,"refunds":null}
  ]'::jsonb,
  '[
    {"expense_item_id":"81818181-1818-4818-8818-181818181831","display_value":null,"customer_count_basis":null},
    {"expense_item_id":"81818181-1818-4818-8818-181818181832","display_value":null,"customer_count_basis":"total_paying_customers"},
    {"expense_item_id":"81818181-1818-4818-8818-181818181833","display_value":null,"customer_count_basis":null}
  ]'::jsonb
);

select * from public.copy_previous_month_expenses(
  'a8181818-1818-4818-8818-181818181818', '2026-02-01'
);

do $$
declare
  february_id uuid;
begin
  select id into february_id from public.monthly_periods
  where business_id = 'a8181818-1818-4818-8818-181818181818' and month_start = '2026-02-01';

  if (select count(*) from public.monthly_expense_entries where monthly_period_id = february_id and input_value is not null) <> 3 then
    raise exception 'previous-month expense inputs were not copied into blank target values';
  end if;

  if not exists (
    select 1 from public.monthly_revenue_entries
    where monthly_period_id = february_id
      and revenue_stream_id = '81818181-1818-4818-8818-181818181811'
      and gross_cash_collected = 0
      and refunds = 0
  ) then raise exception 'explicit zero revenue/refund was not preserved'; end if;

  if not exists (
    select 1 from public.monthly_revenue_entries
    where monthly_period_id = february_id
      and revenue_stream_id = '81818181-1818-4818-8818-181818181812'
      and gross_cash_collected is null
      and refunds is null
  ) then raise exception 'missing revenue/refund was not preserved as null'; end if;
end $$;

update public.revenue_streams
set name = 'Front End Renamed', stream_type = 'backend'
where id = '81818181-1818-4818-8818-181818181811';

update public.expense_items
set name = 'Ad Spend Reclassified', category = 'financial', cost_behavior = 'percentage_revenue'
where id = '81818181-1818-4818-8818-181818181831';

select public.save_monthly_actuals(
  'a8181818-1818-4818-8818-181818181818',
  '2026-01-01',
  10,
  15,
  500,
  100,
  'January edited',
  '[{"revenue_stream_id":"81818181-1818-4818-8818-181818181811","gross_cash_collected":"11000","refunds":"600"}]'::jsonb,
  '[{"expense_item_id":"81818181-1818-4818-8818-181818181831","display_value":"2500","customer_count_basis":null}]'::jsonb
);

do $$
declare
  january_id uuid;
begin
  select id into january_id from public.monthly_periods
  where business_id = 'a8181818-1818-4818-8818-181818181818' and month_start = '2026-01-01';

  if not exists (
    select 1 from public.monthly_revenue_entries
    where monthly_period_id = january_id
      and revenue_stream_id = '81818181-1818-4818-8818-181818181811'
      and stream_name_snapshot = 'Front End A'
      and stream_type_snapshot = 'front_end'
      and gross_cash_collected = 11000
  ) then raise exception 'historical revenue snapshot changed after stream reclassification'; end if;

  if not exists (
    select 1 from public.monthly_expense_entries
    where monthly_period_id = january_id
      and expense_item_id = '81818181-1818-4818-8818-181818181831'
      and expense_name_snapshot = 'Ad Spend'
      and category_snapshot = 'acquisition'
      and cost_behavior_snapshot = 'fixed_monthly'
      and input_value = 2500
  ) then raise exception 'historical expense snapshot changed after expense reclassification'; end if;
end $$;

select * from public.copy_previous_month_expenses(
  'a8181818-1818-4818-8818-181818181818', '2026-03-01'
);

do $$
declare
  march_id uuid;
begin
  select id into march_id from public.monthly_periods
  where business_id = 'a8181818-1818-4818-8818-181818181818' and month_start = '2026-03-01';

  if (select count(*) from public.monthly_expense_entries where monthly_period_id = march_id and input_value is not null) <> 2 then
    raise exception 'copy did not skip expense whose behavior changed';
  end if;
end $$;

do $$
begin
  begin
    perform public.save_monthly_actuals(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01', 8, 7, 0, 0, null, '[]'::jsonb, '[]'::jsonb
    );
    raise exception 'new_customers > total_paying_customers was accepted';
  exception when sqlstate '22023' then null; end;

  begin
    perform public.save_monthly_actuals(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01', 1, 1, -1, 0, null, '[]'::jsonb, '[]'::jsonb
    );
    raise exception 'negative monthly monetary input was accepted';
  exception when sqlstate '22023' then null; end;

  begin
    perform public.save_monthly_actuals(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01', 1, 1, 0, 0, null,
      '[{"revenue_stream_id":"82828282-2828-4828-8828-282828282821","gross_cash_collected":"1","refunds":"0"}]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'cross-business revenue stream was accepted';
  exception when insufficient_privilege then null; end;

  begin
    perform public.save_monthly_actuals(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01', 1, 1, 0, 0, null,
      '[]'::jsonb,
      '[{"expense_item_id":"82828282-2828-4828-8828-282828282831","display_value":"1","customer_count_basis":null}]'::jsonb
    );
    raise exception 'cross-business expense item was accepted';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.monthly_periods (business_id, month_start)
    values ('a8181818-1818-4818-8818-181818181818', '2026-05-01');
    raise exception 'owner received direct monthly insert permission';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"38383838-3838-4838-8838-383838383838","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.monthly_periods where business_id = 'a8181818-1818-4818-8818-181818181818') < 3 then
    raise exception 'business member cannot read monthly periods';
  end if;

  begin
    perform public.save_monthly_actuals(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01', 1, 1, 0, 0, null, '[]'::jsonb, '[]'::jsonb
    );
    raise exception 'business member saved monthly data';
  exception when insufficient_privilege then null; end;

  begin
    perform public.copy_previous_month_expenses(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01'
    );
    raise exception 'business member copied monthly expenses';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"28282828-2828-4828-8828-282828282828","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.monthly_periods
    where business_id = 'a8181818-1818-4818-8818-181818181818'
  ) then raise exception 'other mentee can read Business A monthly data'; end if;

  begin
    perform public.save_monthly_actuals(
      'a8181818-1818-4818-8818-181818181818', '2026-04-01', 1, 1, 0, 0, null, '[]'::jsonb, '[]'::jsonb
    );
    raise exception 'other mentee saved Business A monthly data';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"48484848-4848-4848-8848-484848484848","role":"authenticated","app_metadata":{"role":"admin"}}';

select public.save_monthly_actuals(
  'b8282828-2828-4828-8828-282828282828', '2026-01-01', 1, 1, 50, 0, null,
  '[{"revenue_stream_id":"82828282-2828-4828-8828-282828282821","gross_cash_collected":"500","refunds":"0"}]'::jsonb,
  '[{"expense_item_id":"82828282-2828-4828-8828-282828282831","display_value":"100","customer_count_basis":null}]'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.monthly_periods
    where business_id = 'b8282828-2828-4828-8828-282828282828' and month_start = '2026-01-01'
  ) then raise exception 'admin could not manage Business B monthly data'; end if;
end $$;

rollback;

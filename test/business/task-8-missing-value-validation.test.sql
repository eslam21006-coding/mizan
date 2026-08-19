begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  'task8-missing-values@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  'Task 8 Missing Values',
  'EGP',
  'Africa/Cairo',
  '2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  '5a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a'
);

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values (
  'e2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  'Coach delivery',
  'fulfillment',
  'per_customer',
  '6a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  '2026-08-01',
  null,
  null,
  null,
  null,
  null,
  '[]'::jsonb,
  '[]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = 'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a'
      and month_start = '2026-08-01'
      and unallocated_gross_cash_collected is null
      and unallocated_refunds is null
  ) then
    raise exception 'blank unallocated inputs were not preserved as missing';
  end if;
end $$;

select public.save_monthly_actuals(
  'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
  '2026-09-01',
  0,
  0,
  0,
  0,
  null,
  '[]'::jsonb,
  '[]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = 'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a'
      and month_start = '2026-09-01'
      and unallocated_gross_cash_collected = 0
      and unallocated_refunds = 0
      and new_customers = 0
      and total_paying_customers = 0
  ) then
    raise exception 'explicit zero monthly inputs were not preserved as zero';
  end if;
end $$;

do $$
begin
  begin
    perform public.save_monthly_actuals(
      'a2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
      '2026-10-01',
      1,
      1,
      null,
      null,
      null,
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'expense_item_id', 'e2a2a2a2-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
          'display_value', '10',
          'customer_count_basis', null
        )
      )
    );
    raise exception 'missing per-customer basis was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

rollback;

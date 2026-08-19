begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '1d181818-1818-4818-8818-181818181818',
  'task8-history-protection@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
) values (
  'ad181818-1818-4818-8818-181818181818',
  'Task 8 History Protection',
  'EGP',
  'Africa/Cairo',
  '1d181818-1818-4818-8818-181818181818',
  '5d181818-1818-4818-8818-181818181818'
);

insert into public.revenue_streams (
  id, business_id, name, stream_type, creation_request_id
) values (
  '8d181818-1818-4818-8818-181818181811',
  'ad181818-1818-4818-8818-181818181818',
  'Historical Revenue',
  'front_end',
  '9d181818-1818-4818-8818-181818181811'
);

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
) values (
  '8d181818-1818-4818-8818-181818181831',
  'ad181818-1818-4818-8818-181818181818',
  'Historical Expense',
  'overhead',
  'fixed_monthly',
  '9d181818-1818-4818-8818-181818181831'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"1d181818-1818-4818-8818-181818181818","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  'ad181818-1818-4818-8818-181818181818',
  '2026-08-01',
  1,
  1,
  0,
  0,
  null,
  '[{"revenue_stream_id":"8d181818-1818-4818-8818-181818181811","gross_cash_collected":"100","refunds":"0"}]'::jsonb,
  '[{"expense_item_id":"8d181818-1818-4818-8818-181818181831","display_value":"50","customer_count_basis":null}]'::jsonb
);

reset role;

do $$
begin
  begin
    delete from public.revenue_streams
    where id = '8d181818-1818-4818-8818-181818181811';
    raise exception 'historical revenue stream hard-delete unexpectedly succeeded';
  exception when foreign_key_violation then
    null;
  end;

  begin
    delete from public.expense_items
    where id = '8d181818-1818-4818-8818-181818181831';
    raise exception 'historical expense item hard-delete unexpectedly succeeded';
  exception when foreign_key_violation then
    null;
  end;

  delete from public.businesses
  where id = 'ad181818-1818-4818-8818-181818181818';

  if exists (
    select 1 from public.monthly_periods
    where business_id = 'ad181818-1818-4818-8818-181818181818'
  ) then
    raise exception 'business deletion did not cascade monthly history';
  end if;
end $$;

rollback;

begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '1c181818-1818-4818-8818-181818181818',
  'task8-percentage-precision@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
) values (
  'ac181818-1818-4818-8818-181818181818',
  'Task 8 Percentage Precision',
  'EGP',
  'Africa/Cairo',
  '1c181818-1818-4818-8818-181818181818',
  '5c181818-1818-4818-8818-181818181818'
);

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
) values (
  '8c181818-1818-4818-8818-181818181831',
  'ac181818-1818-4818-8818-181818181818',
  'Precision Processor Fee',
  'financial',
  'percentage_revenue',
  '9c181818-1818-4818-8818-181818181831'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"1c181818-1818-4818-8818-181818181818","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  'ac181818-1818-4818-8818-181818181818',
  '2026-08-01',
  null,
  null,
  0,
  0,
  null,
  '[]'::jsonb,
  '[{"expense_item_id":"8c181818-1818-4818-8818-181818181831","display_value":"3.12345678","customer_count_basis":null}]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_expense_entries
    where business_id = 'ac181818-1818-4818-8818-181818181818'
      and expense_item_id = '8c181818-1818-4818-8818-181818181831'
      and input_value = 0.0312345678
  ) then
    raise exception '8-decimal human percentage did not preserve its exact decimal rate';
  end if;
end $$;

rollback;

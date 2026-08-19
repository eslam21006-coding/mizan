insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  'task7-trimmed-name@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  'Task 7 Trimmed Name Compatibility',
  'EGP',
  'Africa/Cairo',
  '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  '5a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
);

insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
)
values (
  'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  repeat('x', 120) || '   ',
  'overhead',
  'fixed_monthly',
  '6a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
);

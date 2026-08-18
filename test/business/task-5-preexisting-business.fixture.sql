insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '44444444-4444-4444-8444-444444444444',
  'task5-preexisting@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

set role authenticated;
set request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.businesses (id, name, base_currency, timezone, owner_user_id)
values (
  'b4444444-4444-4444-8444-444444444444',
  'Pre-existing Business',
  'EGP',
  'Africa/Cairo',
  '44444444-4444-4444-8444-444444444444'
);

reset role;

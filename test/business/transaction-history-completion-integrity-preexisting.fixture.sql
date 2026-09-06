insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '81818181-8181-4818-8818-818181818181',
  'history-integrity-existing@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '81818181-aaaa-4818-8818-818181818181',
  'Preexisting Invalid History Business',
  'USD',
  'Africa/Cairo',
  '81818181-8181-4818-8818-818181818181',
  '81818181-bbbb-4818-8818-818181818181'
);

update public.business_transaction_history_status
set
  is_complete = true,
  confirmed_at = now(),
  confirmed_by_user_id = '81818181-8181-4818-8818-818181818181',
  updated_at = now()
where business_id = '81818181-aaaa-4818-8818-818181818181';

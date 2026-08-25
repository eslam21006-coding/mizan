insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '20202020-2020-4020-8020-202020202090',
  'task20-hardening-legacy@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
) values (
  '20202020-2020-4020-8020-20202020a090',
  'Task 20 Hardening Legacy',
  'EGP',
  'Africa/Cairo',
  '20202020-2020-4020-8020-202020202090',
  '20202020-2020-4020-8020-20202020c090'
);

insert into public.customer_transaction_sources (
  business_id, source, created_by_user_id
) values (
  '20202020-2020-4020-8020-20202020a090',
  'legacy',
  '20202020-2020-4020-8020-202020202090'
);

insert into public.customer_transactions (
  id, business_id, source, source_transaction_id, import_row_token,
  customer_email, transaction_date, amount_collected, transaction_type,
  source_row_number, imported_by_user_id
) values (
  '20202020-2020-4020-8020-20202020f090',
  '20202020-2020-4020-8020-20202020a090',
  'legacy',
  'legacy-1',
  '20202020-2020-4020-8020-20202020e090',
  'legacy@example.com',
  '2026-08-24',
  25,
  'collection',
  1,
  '20202020-2020-4020-8020-202020202090'
);

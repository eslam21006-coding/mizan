begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('51515151-5151-4515-8515-515151515151', 'derived-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('52525252-5252-4525-8525-525252525252', 'derived-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  (
    '51515151-aaaa-4515-8515-515151515151',
    'Derived Counts Business',
    'USD',
    'Africa/Cairo',
    '51515151-5151-4515-8515-515151515151',
    '51515151-bbbb-4515-8515-515151515151'
  ),
  (
    '52525252-aaaa-4525-8525-525252525252',
    'Other Business',
    'USD',
    'Africa/Cairo',
    '52525252-5252-4525-8525-525252525252',
    '52525252-bbbb-4525-8525-525252525252'
  );

insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
values (
  '51515151-aaaa-4515-8515-515151515151',
  'stripe',
  '51515151-5151-4515-8515-515151515151'
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
  imported_by_user_id
) values
  (
    '61000000-0000-4000-8000-000000000001',
    '51515151-aaaa-4515-8515-515151515151',
    'stripe', 'tx-bob-june', '62000000-0000-4000-8000-000000000001',
    'bob@example.test', '2026-06-10', '2026-06-10T12:00:00+03:00', '2026-06-10T09:00:00Z',
    100, 'collection', 'successful', 'USD', 1,
    '51515151-5151-4515-8515-515151515151'
  ),
  (
    '61000000-0000-4000-8000-000000000002',
    '51515151-aaaa-4515-8515-515151515151',
    'stripe', 'tx-alice-first', '62000000-0000-4000-8000-000000000002',
    'alice@example.test', '2026-07-02', '2026-07-02T12:00:00+03:00', '2026-07-02T09:00:00Z',
    200, 'collection', 'successful', 'USD', 2,
    '51515151-5151-4515-8515-515151515151'
  ),
  (
    '61000000-0000-4000-8000-000000000003',
    '51515151-aaaa-4515-8515-515151515151',
    'stripe', 'tx-alice-upsell', '62000000-0000-4000-8000-000000000003',
    'alice@example.test', '2026-07-05', '2026-07-05T12:00:00+03:00', '2026-07-05T09:00:00Z',
    50, 'collection', 'successful', 'USD', 3,
    '51515151-5151-4515-8515-515151515151'
  ),
  (
    '61000000-0000-4000-8000-000000000004',
    '51515151-aaaa-4515-8515-515151515151',
    'stripe', 'tx-bob-july', '62000000-0000-4000-8000-000000000004',
    'bob@example.test', '2026-07-10', '2026-07-10T12:00:00+03:00', '2026-07-10T09:00:00Z',
    150, 'collection', 'successful', 'USD', 4,
    '51515151-5151-4515-8515-515151515151'
  ),
  (
    '61000000-0000-4000-8000-000000000005',
    '51515151-aaaa-4515-8515-515151515151',
    'stripe', 'tx-carol-refund', '62000000-0000-4000-8000-000000000005',
    'carol@example.test', '2026-07-15', '2026-07-15T12:00:00+03:00', '2026-07-15T09:00:00Z',
    30, 'refund', 'successful', 'USD', 5,
    '51515151-5151-4515-8515-515151515151'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"51515151-5151-4515-8515-515151515151","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  '51515151-aaaa-4515-8515-515151515151',
  '2026-07-01',
  99,
  99,
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
    where business_id = '51515151-aaaa-4515-8515-515151515151'
      and month_start = '2026-07-01'
      and new_customers = 1
      and total_paying_customers = 2
  ) then
    raise exception 'July customer counts were not derived from transaction history';
  end if;
end $$;

select public.save_monthly_actuals(
  '51515151-aaaa-4515-8515-515151515151',
  '2026-08-01',
  7,
  8,
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
    where business_id = '51515151-aaaa-4515-8515-515151515151'
      and month_start = '2026-08-01'
      and new_customers = 7
      and total_paying_customers = 8
  ) then
    raise exception 'Month without imported collections did not preserve manual fallback counts';
  end if;
end $$;

select public.import_customer_transactions(
  '51515151-aaaa-4515-8515-515151515151',
  'stripe',
  '[{"row_number":6,"transaction_id":"tx-dave-august","import_row_token":"62000000-0000-4000-8000-000000000006","customer_email":"dave@example.test","transaction_date":"2026-08-03T12:00:00+03:00","amount_collected":"25","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '51515151-aaaa-4515-8515-515151515151'
      and month_start = '2026-08-01'
      and new_customers = 1
      and total_paying_customers = 1
  ) then
    raise exception 'Import did not refresh a previously manual monthly period';
  end if;
end $$;

select public.import_customer_transactions(
  '51515151-aaaa-4515-8515-515151515151',
  'stripe',
  '[{"row_number":7,"transaction_id":"tx-alice-backdated","import_row_token":"62000000-0000-4000-8000-000000000007","customer_email":"alice@example.test","transaction_date":"2026-06-05T12:00:00+03:00","amount_collected":"10","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '51515151-aaaa-4515-8515-515151515151'
      and month_start = '2026-07-01'
      and new_customers = 0
      and total_paying_customers = 2
  ) then
    raise exception 'Backdated import did not refresh acquisition counts for an existing later period';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"52525252-5252-4525-8525-525252525252","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.save_monthly_actuals(
      '51515151-aaaa-4515-8515-515151515151',
      '2026-09-01',
      1,
      1,
      null,
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'unauthorized user saved transaction-derived monthly counts';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

do $$
declare
  import_definition text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_proc as procedure on procedure.oid = trigger.tgfoid
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where trigger.tgname = 'lock_customer_transaction_monthly_counts'
      and trigger.tgrelid = 'public.customer_transactions'::regclass
      and not trigger.tgisinternal
      and namespace.nspname = 'private'
      and procedure.proname = 'lock_customer_transaction_monthly_counts'
      and pg_catalog.pg_get_functiondef(procedure.oid) like '%pg_advisory_xact_lock%'
      and pg_catalog.pg_get_functiondef(procedure.oid) like '%monthly-customer-counts:%'
  ) then
    raise exception 'customer transaction serialization trigger or shared advisory-lock key is missing';
  end if;

  import_definition :=
    pg_catalog.pg_get_functiondef('public.import_customer_transactions(uuid,text,jsonb)'::regprocedure);

  if position('monthly-customer-counts:' in import_definition) = 0
     or position('private.refresh_monthly_customer_counts_for_business' in import_definition) = 0 then
    raise exception 'transaction import wrapper does not retain the shared lock through monthly refresh';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = 'refresh_monthly_customer_counts_for_business'
      and pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'target_business_id uuid'
  ) then
    raise exception 'private monthly customer-count refresh worker is missing';
  end if;
end $$;

rollback;

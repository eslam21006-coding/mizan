begin;

-- Existing Task 20 rows survive the hardening migration and gain explicit audit metadata.
do $$
begin
  if not exists (
    select 1
    from public.customer_transactions
    where id = '20202020-2020-4020-8020-20202020f090'
      and source_transaction_at = '2026-08-24'
      and transaction_at = '2026-08-23 21:00:00+00'::timestamptz
      and transaction_date = '2026-08-24'
      and currency = 'EGP'
      and normalized_outcome = 'successful'
  ) then
    raise exception 'legacy Task 20 transaction was not backfilled with timestamp/currency/outcome metadata';
  end if;
end;
$$;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '21212121-2121-4121-8121-212121212001',
  'task20-hardening-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
) values (
  '21212121-2121-4121-8121-21212121a001',
  'Task 20 Semantic Hardening',
  'EGP',
  'Africa/Cairo',
  '21212121-2121-4121-8121-212121212001',
  '21212121-2121-4121-8121-21212121c001'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"21212121-2121-4121-8121-212121212001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  first_result jsonb;
  candidate_result jsonb;
  local_date_result jsonb;
begin
  perform public.create_customer_transaction_source(
    '21212121-2121-4121-8121-21212121a001',
    'Stripe'
  );

  first_result := public.import_customer_transactions(
    '21212121-2121-4121-8121-21212121a001',
    'stripe',
    '[{
      "row_number":1,
      "transaction_id":null,
      "import_row_token":"21212121-2121-4121-8121-21212121e001",
      "customer_email":" Buyer@Example.com ",
      "transaction_date":"2026-08-24T23:30:00Z",
      "amount_collected":"100",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (first_result ->> 'inserted_count')::integer <> 1 then
    raise exception 'timestamped successful collection did not import: %', first_result;
  end if;

  if not exists (
    select 1
    from public.customer_transactions
    where business_id = '21212121-2121-4121-8121-21212121a001'
      and import_row_token = '21212121-2121-4121-8121-21212121e001'
      and customer_email = 'buyer@example.com'
      and source_transaction_at = '2026-08-24T23:30:00Z'
      and transaction_at = '2026-08-24 23:30:00+00'::timestamptz
      and transaction_date = '2026-08-25'
      and normalized_outcome = 'successful'
      and currency = 'EGP'
  ) then
    raise exception 'source timestamp/offset, canonical instant, reporting date, currency, or outcome was not preserved';
  end if;

  candidate_result := public.import_customer_transactions(
    '21212121-2121-4121-8121-21212121a001',
    'stripe',
    '[{
      "row_number":2,
      "transaction_id":null,
      "import_row_token":"21212121-2121-4121-8121-21212121e002",
      "customer_email":"buyer@example.com",
      "transaction_date":"2026-08-25T02:30:00+03:00",
      "amount_collected":"100.00",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (candidate_result ->> 'candidate_count')::integer <> 1 then
    raise exception 'same instant expressed with another offset did not share the canonical candidate identity: %', candidate_result;
  end if;

  local_date_result := public.import_customer_transactions(
    '21212121-2121-4121-8121-21212121a001',
    'stripe',
    '[{
      "row_number":3,
      "transaction_id":"date-only-1",
      "import_row_token":"21212121-2121-4121-8121-21212121e003",
      "customer_email":"dateonly@example.com",
      "transaction_date":"2026-08-26",
      "amount_collected":"50",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (local_date_result ->> 'inserted_count')::integer <> 1
    or not exists (
      select 1 from public.customer_transactions
      where import_row_token = '21212121-2121-4121-8121-21212121e003'
        and transaction_date = '2026-08-26'
        and transaction_at = '2026-08-25 21:00:00+00'::timestamptz
    ) then
    raise exception 'date-only transaction was shifted incorrectly instead of being interpreted in business timezone';
  end if;

  begin
    perform public.import_customer_transactions(
      '21212121-2121-4121-8121-21212121a001',
      'stripe',
      '[{"row_number":4,"transaction_id":"failed-1","import_row_token":"21212121-2121-4121-8121-21212121e004","customer_email":"failed@example.com","transaction_date":"2026-08-26","amount_collected":"10","transaction_type":"collection","normalized_outcome":"unsuccessful","currency":"EGP"}]'::jsonb
    );
    raise exception 'unsuccessful transaction was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '21212121-2121-4121-8121-21212121a001',
      'stripe',
      '[{"row_number":5,"transaction_id":"usd-1","import_row_token":"21212121-2121-4121-8121-21212121e005","customer_email":"usd@example.com","transaction_date":"2026-08-26","amount_collected":"10","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}]'::jsonb
    );
    raise exception 'foreign currency transaction was accepted without conversion';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

rollback;

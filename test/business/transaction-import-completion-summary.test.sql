begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  (
    '91919191-9191-4919-8919-919191919191',
    'import-summary-owner@example.test',
    '{"role":"mentee"}'::jsonb,
    now(),
    now()
  ),
  (
    '92929292-9292-4929-8929-929292929292',
    'import-summary-member@example.test',
    '{"role":"mentee"}'::jsonb,
    now(),
    now()
  ),
  (
    '93939393-9393-4939-8939-939393939393',
    'import-summary-outsider@example.test',
    '{"role":"mentee"}'::jsonb,
    now(),
    now()
  ),
  (
    '94949494-9494-4949-8949-949494949494',
    'import-summary-admin@example.test',
    '{"role":"admin"}'::jsonb,
    now(),
    now()
  );

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '91919191-aaaa-4919-8919-919191919191',
  'Import Completion Summary Business',
  'USD',
  'Africa/Cairo',
  '91919191-9191-4919-8919-919191919191',
  '91919191-bbbb-4919-8919-919191919191'
);

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  '91919191-aaaa-4919-8919-919191919191',
  '92929292-9292-4929-8929-929292929292',
  'member'
);

insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
values (
  '91919191-aaaa-4919-8919-919191919191',
  'gateway',
  '91919191-9191-4919-8919-919191919191'
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
    '91000000-0000-4000-8000-000000000001',
    '91919191-aaaa-4919-8919-919191919191',
    'gateway',
    'purchase-a',
    '91000000-0000-4000-8000-000000000011',
    'alice@example.test',
    '2026-01-10',
    '2026-01-10T12:00:00+02:00',
    '2026-01-10T10:00:00Z',
    100.25,
    'collection',
    'successful',
    'USD',
    1,
    '91919191-9191-4919-8919-919191919191'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '91919191-aaaa-4919-8919-919191919191',
    'gateway',
    'refund-a',
    '91000000-0000-4000-8000-000000000012',
    'alice@example.test',
    '2026-02-12',
    '2026-02-12T12:00:00+02:00',
    '2026-02-12T10:00:00Z',
    20.05,
    'refund',
    'successful',
    'USD',
    2,
    '91919191-9191-4919-8919-919191919191'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    '91919191-aaaa-4919-8919-919191919191',
    'gateway',
    'purchase-b',
    '91000000-0000-4000-8000-000000000013',
    'bob@example.test',
    '2026-03-14',
    '2026-03-14T12:00:00+02:00',
    '2026-03-14T10:00:00Z',
    50.50,
    'collection',
    'successful',
    'USD',
    3,
    '91919191-9191-4919-8919-919191919191'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"91919191-9191-4919-8919-919191919191","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  summary jsonb;
begin
  summary := public.transaction_import_completion_summary(
    '91919191-aaaa-4919-8919-919191919191',
    array[
      '91000000-0000-4000-8000-000000000011'::uuid,
      '91000000-0000-4000-8000-000000000012'::uuid
    ]
  );

  if summary ->> 'requested_token_count' <> '2' then
    raise exception 'completion summary did not report the requested unique import-token count';
  end if;
  if summary ->> 'persisted_inserted_count' <> '2' then
    raise exception 'completion summary did not verify the two persisted session rows';
  end if;
  if summary ->> 'session_unique_customer_count' <> '1' then
    raise exception 'completion summary did not deduplicate the session customer identity';
  end if;
  if summary ->> 'session_first_transaction_date' <> '2026-01-10'
    or summary ->> 'session_last_transaction_date' <> '2026-02-12' then
    raise exception 'completion summary returned the wrong session date range';
  end if;
  if summary ->> 'session_net_cash_collected' <> '80.2' then
    raise exception 'completion summary must subtract refunds from session net cash exactly';
  end if;
  if summary ->> 'business_transaction_count' <> '3'
    or summary ->> 'business_unique_customer_count' <> '2' then
    raise exception 'completion summary returned the wrong persisted business totals';
  end if;
  if summary ->> 'business_first_transaction_date' <> '2026-01-10'
    or summary ->> 'business_last_transaction_date' <> '2026-03-14' then
    raise exception 'completion summary returned the wrong business transaction-history range';
  end if;
  if summary ->> 'business_net_cash_collected' <> '130.7' then
    raise exception 'completion summary must calculate exact business Net Cash Collected';
  end if;
end $$;

do $$
declare
  summary jsonb;
begin
  summary := public.transaction_import_completion_summary(
    '91919191-aaaa-4919-8919-919191919191',
    array['91000000-0000-4000-8000-000000000099'::uuid]
  );

  if summary ->> 'persisted_inserted_count' <> '0'
    or summary ->> 'session_unique_customer_count' <> '0'
    or summary -> 'session_first_transaction_date' <> 'null'::jsonb
    or summary -> 'session_last_transaction_date' <> 'null'::jsonb
    or summary ->> 'session_net_cash_collected' <> '0' then
    raise exception 'duplicate-only/no-new-row verification must report a zero persisted session without inventing dates or cash';
  end if;
  if summary ->> 'business_transaction_count' <> '3'
    or summary ->> 'business_unique_customer_count' <> '2'
    or summary ->> 'business_net_cash_collected' <> '130.7' then
    raise exception 'duplicate-only verification lost the already-persisted business totals';
  end if;
end $$;

do $$
begin
  begin
    perform public.transaction_import_completion_summary(
      '91919191-aaaa-4919-8919-919191919191',
      array[]::uuid[]
    );
    raise exception 'empty import-token verification was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

-- Browser validation accepts up to 100,000 non-empty source rows, so every accepted
-- transaction token set must remain verifiable after persistence.
do $$
declare
  tokens uuid[];
  summary jsonb;
begin
  select array_agg(lpad(to_hex(i), 32, '0')::uuid order by i)
  into tokens
  from generate_series(1, 100000) as i;

  summary := public.transaction_import_completion_summary(
    '91919191-aaaa-4919-8919-919191919191',
    tokens
  );

  if summary ->> 'requested_token_count' <> '100000'
    or summary ->> 'persisted_inserted_count' <> '0' then
    raise exception 'completion verification did not accept the full 100000-row source boundary';
  end if;
end $$;

do $$
declare
  tokens uuid[];
begin
  select array_agg(lpad(to_hex(i), 32, '0')::uuid order by i)
  into tokens
  from generate_series(1, 100001) as i;

  begin
    perform public.transaction_import_completion_summary(
      '91919191-aaaa-4919-8919-919191919191',
      tokens
    );
    raise exception 'completion verification accepted more tokens than the source reader permits';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"92929292-9292-4929-8929-929292929292","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.transaction_import_completion_summary(
      '91919191-aaaa-4919-8919-919191919191',
      array['91000000-0000-4000-8000-000000000011'::uuid]
    );
    raise exception 'read-only business member could verify import completion';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"93939393-9393-4939-8939-939393939393","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.transaction_import_completion_summary(
      '91919191-aaaa-4919-8919-919191919191',
      array['91000000-0000-4000-8000-000000000011'::uuid]
    );
    raise exception 'unrelated mentee could verify another business import completion';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"94949494-9494-4949-8949-949494949494","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
declare
  summary jsonb;
begin
  summary := public.transaction_import_completion_summary(
    '91919191-aaaa-4919-8919-919191919191',
    array['91000000-0000-4000-8000-000000000013'::uuid]
  );
  if summary ->> 'persisted_inserted_count' <> '1' then
    raise exception 'admin could not verify import completion';
  end if;
end $$;

reset role;
set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform public.transaction_import_completion_summary(
      '91919191-aaaa-4919-8919-919191919191',
      array['91000000-0000-4000-8000-000000000011'::uuid]
    );
    raise exception 'anonymous caller could execute import completion summary';
  exception when insufficient_privilege or undefined_function then
    null;
  end;
end $$;

rollback;
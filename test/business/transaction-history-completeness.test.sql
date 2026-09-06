begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('71717171-7171-4717-8717-717171717171', 'history-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('72727272-7272-4727-8727-727272727272', 'history-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('73737373-7373-4737-8737-737373737373', 'history-admin@example.test', '{"role":"admin"}'::jsonb, now(), now()),
  ('74747474-7474-4747-8747-747474747474', 'history-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '71717171-aaaa-4717-8717-717171717171',
  'History Completeness Business',
  'USD',
  'Africa/Cairo',
  '71717171-7171-4717-8717-717171717171',
  '71717171-bbbb-4717-8717-717171717171'
);

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  '71717171-aaaa-4717-8717-717171717171',
  '72727272-7272-4727-8727-727272727272',
  'member'
);

insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
values (
  '71717171-aaaa-4717-8717-717171717171',
  'stripe',
  '71717171-7171-4717-8717-717171717171'
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
    '71000000-0000-4000-8000-000000000001',
    '71717171-aaaa-4717-8717-717171717171',
    'stripe', 'history-bob-june', '72000000-0000-4000-8000-000000000001',
    'bob@example.test', '2026-06-10', '2026-06-10T12:00:00+03:00', '2026-06-10T09:00:00Z',
    100, 'collection', 'successful', 'USD', 1,
    '71717171-7171-4717-8717-717171717171'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '71717171-aaaa-4717-8717-717171717171',
    'stripe', 'history-alice-july', '72000000-0000-4000-8000-000000000002',
    'alice@example.test', '2026-07-02', '2026-07-02T12:00:00+03:00', '2026-07-02T09:00:00Z',
    200, 'collection', 'successful', 'USD', 2,
    '71717171-7171-4717-8717-717171717171'
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '71717171-aaaa-4717-8717-717171717171',
    'stripe', 'history-alice-upsell', '72000000-0000-4000-8000-000000000003',
    'alice@example.test', '2026-07-05', '2026-07-05T12:00:00+03:00', '2026-07-05T09:00:00Z',
    50, 'collection', 'successful', 'USD', 3,
    '71717171-7171-4717-8717-717171717171'
  ),
  (
    '71000000-0000-4000-8000-000000000004',
    '71717171-aaaa-4717-8717-717171717171',
    'stripe', 'history-bob-july', '72000000-0000-4000-8000-000000000004',
    'bob@example.test', '2026-07-10', '2026-07-10T12:00:00+03:00', '2026-07-10T09:00:00Z',
    150, 'collection', 'successful', 'USD', 4,
    '71717171-7171-4717-8717-717171717171'
  );

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and is_complete = false
      and confirmed_at is null
      and confirmed_by_user_id is null
  ) then
    raise exception 'new businesses must default to incomplete transaction history';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171717171","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  '71717171-aaaa-4717-8717-717171717171',
  '2026-07-01',
  2,
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
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and month_start = '2026-07-01'
      and new_customers = 2
      and total_paying_customers = 2
  ) then
    raise exception 'incomplete history must preserve manual New Customers while deriving Paying Customers';
  end if;
end $$;

select public.import_customer_transactions(
  '71717171-aaaa-4717-8717-717171717171',
  'stripe',
  '[{"row_number":5,"transaction_id":"history-alice-repeat","import_row_token":"72000000-0000-4000-8000-000000000005","customer_email":"alice@example.test","transaction_date":"2026-07-20T12:00:00+03:00","amount_collected":"25","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and month_start = '2026-07-01'
      and new_customers = 2
      and total_paying_customers = 2
  ) then
    raise exception 'transaction refresh changed manual New Customers before history was confirmed complete';
  end if;
end $$;

do $$
begin
  begin
    update public.business_transaction_history_status
    set is_complete = true,
        confirmed_at = now(),
        confirmed_by_user_id = '71717171-7171-4717-8717-717171717171'
    where business_id = '71717171-aaaa-4717-8717-717171717171';
    raise exception 'owner bypassed the completeness RPC with a direct table update';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select public.set_transaction_history_complete(
  '71717171-aaaa-4717-8717-717171717171',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and is_complete = true
      and confirmed_at is not null
      and confirmed_by_user_id = '71717171-7171-4717-8717-717171717171'
  ) then
    raise exception 'owner confirmation did not persist audited complete-history state';
  end if;

  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and month_start = '2026-07-01'
      and new_customers = 1
      and total_paying_customers = 2
  ) then
    raise exception 'marking history complete did not recalculate existing monthly New Customers';
  end if;
end $$;

select public.save_monthly_actuals(
  '71717171-aaaa-4717-8717-717171717171',
  '2026-07-01',
  2,
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
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and month_start = '2026-07-01'
      and new_customers = 1
      and total_paying_customers = 2
  ) then
    raise exception 'complete history did not make New Customers authoritative during monthly save';
  end if;
end $$;

select public.import_customer_transactions(
  '71717171-aaaa-4717-8717-717171717171',
  'stripe',
  '[{"row_number":6,"transaction_id":"history-alice-backdated","import_row_token":"72000000-0000-4000-8000-000000000006","customer_email":"alice@example.test","transaction_date":"2026-05-15T12:00:00+03:00","amount_collected":"10","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and month_start = '2026-07-01'
      and new_customers = 0
      and total_paying_customers = 2
  ) then
    raise exception 'complete-history backdated import did not refresh later acquisition counts';
  end if;
end $$;

select public.set_transaction_history_complete(
  '71717171-aaaa-4717-8717-717171717171',
  false
);

select public.save_monthly_actuals(
  '71717171-aaaa-4717-8717-717171717171',
  '2026-07-01',
  2,
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
    from public.business_transaction_history_status
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and is_complete = false
      and confirmed_at is null
      and confirmed_by_user_id is null
  ) then
    raise exception 'revoking completeness did not clear confirmation metadata';
  end if;

  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and month_start = '2026-07-01'
      and new_customers = 2
      and total_paying_customers = 2
  ) then
    raise exception 'revoked completeness did not restore manual New Customer behavior';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"72727272-7272-4727-8727-727272727272","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '71717171-aaaa-4717-8717-717171717171'
  ) then
    raise exception 'read-only business member could not read history completeness status';
  end if;

  begin
    perform public.set_transaction_history_complete(
      '71717171-aaaa-4717-8717-717171717171',
      true
    );
    raise exception 'read-only member changed transaction-history completeness';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"74747474-7474-4747-8747-747474747474","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.set_transaction_history_complete(
      '71717171-aaaa-4717-8717-717171717171',
      true
    );
    raise exception 'outsider changed transaction-history completeness';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"73737373-7373-4737-8737-737373737373","role":"authenticated","app_metadata":{"role":"admin"}}';

select public.set_transaction_history_complete(
  '71717171-aaaa-4717-8717-717171717171',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '71717171-aaaa-4717-8717-717171717171'
      and is_complete = true
      and confirmed_by_user_id = '73737373-7373-4737-8737-737373737373'
  ) then
    raise exception 'admin could not confirm transaction-history completeness';
  end if;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.set_transaction_history_complete(uuid,boolean)', 'EXECUTE') then
    raise exception 'anon unexpectedly has execute on transaction-history completeness RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.set_transaction_history_complete(uuid,boolean)', 'EXECUTE') then
    raise exception 'authenticated role is missing execute on transaction-history completeness RPC';
  end if;
end $$;

rollback;

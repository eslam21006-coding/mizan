begin;

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '81818181-aaaa-4818-8818-818181818181'
      and is_complete = false
      and confirmed_at is null
      and confirmed_by_user_id is null
  ) then
    raise exception 'integrity migration did not repair a complete history with no saved customer purchase';
  end if;
end $$;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '82828282-8282-4828-8828-828282828282',
  'history-integrity-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '82828282-aaaa-4828-8828-828282828282',
  'History Completion Integrity Business',
  'USD',
  'Africa/Cairo',
  '82828282-8282-4828-8828-828282828282',
  '82828282-bbbb-4828-8828-828282828282'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"82828282-8282-4828-8828-828282828282","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.set_transaction_history_complete(
      '82828282-aaaa-4828-8828-828282828282',
      true
    );
    raise exception 'history was marked complete without any saved customer purchase';
  exception when sqlstate 'MZ001' then
    null;
  end;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '82828282-aaaa-4828-8828-828282828282'
      and is_complete = false
      and confirmed_at is null
      and confirmed_by_user_id is null
  ) then
    raise exception 'failed completion attempt changed the stored history state';
  end if;
end $$;

reset role;

insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
values (
  '82828282-aaaa-4828-8828-828282828282',
  'gateway',
  '82828282-8282-4828-8828-828282828282'
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
) values (
  '82000000-0000-4000-8000-000000000001',
  '82828282-aaaa-4828-8828-828282828282',
  'gateway',
  'refund-only',
  '82000000-0000-4000-8000-000000000011',
  'buyer@example.test',
  '2026-08-01',
  '2026-08-01T12:00:00+03:00',
  '2026-08-01T09:00:00Z',
  25,
  'refund',
  'successful',
  'USD',
  1,
  '82828282-8282-4828-8828-828282828282'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"82828282-8282-4828-8828-828282828282","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.set_transaction_history_complete(
      '82828282-aaaa-4828-8828-828282828282',
      true
    );
    raise exception 'refund-only history was incorrectly accepted as a saved customer purchase';
  exception when sqlstate 'MZ001' then
    null;
  end;
end $$;

reset role;

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
) values (
  '82000000-0000-4000-8000-000000000002',
  '82828282-aaaa-4828-8828-828282828282',
  'gateway',
  'first-purchase',
  '82000000-0000-4000-8000-000000000012',
  'buyer@example.test',
  '2026-08-02',
  '2026-08-02T12:00:00+03:00',
  '2026-08-02T09:00:00Z',
  100,
  'collection',
  'successful',
  'USD',
  2,
  '82828282-8282-4828-8828-828282828282'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"82828282-8282-4828-8828-828282828282","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.set_transaction_history_complete(
  '82828282-aaaa-4828-8828-828282828282',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '82828282-aaaa-4828-8828-828282828282'
      and is_complete = true
      and confirmed_at is not null
      and confirmed_by_user_id = '82828282-8282-4828-8828-828282828282'
  ) then
    raise exception 'qualifying saved purchase did not allow history completion';
  end if;
end $$;

select public.set_transaction_history_complete(
  '82828282-aaaa-4828-8828-828282828282',
  false
);

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '82828282-aaaa-4828-8828-828282828282'
      and is_complete = false
      and confirmed_at is null
      and confirmed_by_user_id is null
  ) then
    raise exception 'revoking history completion stopped working after the integrity guard';
  end if;
end $$;

rollback;

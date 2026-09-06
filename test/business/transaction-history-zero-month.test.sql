begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values ('77777777-7777-4777-8777-777777777777', 'history-zero-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '77777777-aaaa-4777-8777-777777777777',
  'History Zero Month Business',
  'USD',
  'Africa/Cairo',
  '77777777-7777-4777-8777-777777777777',
  '77777777-bbbb-4777-8777-777777777777'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_monthly_actuals(
  '77777777-aaaa-4777-8777-777777777777',
  '2026-09-01',
  4,
  6,
  null,
  null,
  null,
  '[]'::jsonb,
  '[]'::jsonb
);

select public.set_transaction_history_complete(
  '77777777-aaaa-4777-8777-777777777777',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '77777777-aaaa-4777-8777-777777777777'
      and month_start = '2026-09-01'
      and new_customers = 0
      and total_paying_customers = 0
  ) then
    raise exception 'complete-history confirmation did not zero an existing month with no qualifying collections';
  end if;
end $$;

select public.save_monthly_actuals(
  '77777777-aaaa-4777-8777-777777777777',
  '2026-10-01',
  3,
  5,
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
    where business_id = '77777777-aaaa-4777-8777-777777777777'
      and month_start = '2026-10-01'
      and new_customers = 0
      and total_paying_customers = 0
  ) then
    raise exception 'complete-history monthly save did not treat a zero-collection month as authoritative zero';
  end if;
end $$;

select public.set_transaction_history_complete(
  '77777777-aaaa-4777-8777-777777777777',
  false
);

reset role;

insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
values (
  '77777777-aaaa-4777-8777-777777777777',
  'stripe',
  '77777777-7777-4777-8777-777777777777'
);

insert into public.customer_transactions (
  id, business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, source_transaction_at, transaction_at, amount_collected,
  transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
) values (
  '77000000-0000-4000-8000-000000000001',
  '77777777-aaaa-4777-8777-777777777777',
  'stripe',
  'history-zero-one-payer',
  '77000000-0000-4000-8000-000000000002',
  'onepayer@example.test',
  '2026-11-05',
  '2026-11-05T12:00:00+03:00',
  '2026-11-05T09:00:00Z',
  100,
  'collection',
  'successful',
  'USD',
  1,
  '77777777-7777-4777-8777-777777777777'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.save_monthly_actuals(
      '77777777-aaaa-4777-8777-777777777777',
      '2026-11-01',
      2,
      2,
      null,
      null,
      null,
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'incomplete-history save accepted manual New Customers above transaction-derived Paying Customers';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

rollback;

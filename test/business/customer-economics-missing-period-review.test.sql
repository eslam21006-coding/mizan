begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('78787878-7878-4787-8787-787878780001', 'missing-period-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('78787878-7878-4787-8787-787878780002', 'missing-period-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    '78787878-7878-4787-8787-78787878a001',
    'Missing Period Review Fixture',
    'USD',
    'Africa/Cairo',
    '78787878-7878-4787-8787-787878780001',
    '78787878-7878-4787-8787-78787878c001'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"78787878-7878-4787-8787-787878780001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source(
  '78787878-7878-4787-8787-78787878a001',
  'missing-period-fixture'
);
reset role;

insert into public.customer_transactions (
  business_id,
  source,
  source_transaction_id,
  import_row_token,
  customer_email,
  transaction_date,
  amount_collected,
  transaction_type,
  source_row_number,
  imported_by_user_id,
  source_transaction_at,
  transaction_at,
  currency,
  normalized_outcome
)
values (
  '78787878-7878-4787-8787-78787878a001',
  'missing-period-fixture',
  'missing-period-jan-1',
  gen_random_uuid(),
  'missing-period-customer@example.test',
  '2026-01-05',
  1000,
  'collection',
  1,
  '78787878-7878-4787-8787-787878780001',
  '2026-01-05T10:00:00Z',
  '2026-01-05T10:00:00Z',
  'USD',
  'successful'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"78787878-7878-4787-8787-787878780001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.set_transaction_history_complete(
  '78787878-7878-4787-8787-78787878a001',
  true
);

do $$
declare
  review_row record;
  lcp_row record;
begin
  select * into strict review_row
  from public.customer_economics_missing_period_exceptions
  where business_id = '78787878-7878-4787-8787-78787878a001'
    and activity_month = '2026-01-01'::date;

  if review_row.exception_code is distinct from 'BUSINESS_NET_CASH_MISSING'
    or review_row.currency is distinct from 'USD'
    or review_row.amount is not null
    or review_row.can_manual_override is not false
    or review_row.blocking is not true then
    raise exception 'Missing-period remediation row does not preserve the expected review contract';
  end if;

  select * into strict lcp_row
  from public.customer_lifetime_contribution_profit
  where business_id = '78787878-7878-4787-8787-78787878a001'
    and cohort_month = '2026-01-01'::date;

  if lcp_row.quality_state is distinct from 'incomplete'
    or lcp_row.missing_relevant_period_count is distinct from 1
    or lcp_row.lifetime_contribution_profit is not null then
    raise exception 'Missing-period review row is not aligned with the LCP blocker';
  end if;
end;
$$;
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"78787878-7878-4787-8787-787878780002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1
    from public.customer_economics_missing_period_exceptions
    where business_id = '78787878-7878-4787-8787-78787878a001'
  ) then
    raise exception 'Outsider can see another business missing-period review row';
  end if;
end;
$$;
reset role;

rollback;

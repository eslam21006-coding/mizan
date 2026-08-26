begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '26262626-2626-4262-8262-262626262001',
  'task24-other-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id,
  name,
  base_currency,
  timezone,
  owner_user_id,
  creation_request_id
) values (
  '26262626-2626-4262-8262-26262626a001',
  'Task 24 Other Stream Business',
  'EGP',
  'Africa/Cairo',
  '26262626-2626-4262-8262-262626262001',
  '26262626-2626-4262-8262-26262626c001'
);

insert into public.revenue_streams (
  id,
  business_id,
  name,
  stream_type,
  creation_request_id
) values (
  '26262626-2626-4262-8262-26262626d001',
  '26262626-2626-4262-8262-26262626a001',
  'Other Revenue',
  'other',
  '26262626-2626-4262-8262-26262626e001'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"26262626-2626-4262-8262-262626262001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source(
  '26262626-2626-4262-8262-26262626a001',
  'stripe'
);

select public.import_customer_transactions(
  '26262626-2626-4262-8262-26262626a001',
  'stripe',
  '[
    {
      "row_number":1,
      "transaction_id":"other-1",
      "import_row_token":"26262626-2626-4262-8262-26262626f001",
      "customer_email":"other@example.com",
      "transaction_date":"2026-01-05T10:00:00Z",
      "amount_collected":"150",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }
  ]'::jsonb
);

select public.assign_customer_transaction_revenue_stream(
  '26262626-2626-4262-8262-26262626a001',
  (
    select id
    from public.customer_transactions
    where business_id = '26262626-2626-4262-8262-26262626a001'
      and source_transaction_id = 'other-1'
  ),
  '26262626-2626-4262-8262-26262626d001'
);

update public.revenue_streams
set
  name = 'Renamed Other Revenue',
  stream_type = 'backend'
where business_id = '26262626-2626-4262-8262-26262626a001'
  and id = '26262626-2626-4262-8262-26262626d001';

do $$
declare
  snapshot_name text;
  snapshot_type text;
  analysis_name text;
  analysis_type text;
  analysis_net numeric;
begin
  select
    transaction.revenue_stream_name_snapshot,
    transaction.revenue_stream_type_snapshot
  into snapshot_name, snapshot_type
  from public.customer_transactions as transaction
  where transaction.business_id = '26262626-2626-4262-8262-26262626a001'
    and transaction.source_transaction_id = 'other-1';

  select
    analysis.revenue_stream_name,
    analysis.revenue_stream_type,
    analysis.net_cash_collected
  into analysis_name, analysis_type, analysis_net
  from public.customer_lifetime_revenue_stream_analysis as analysis
  where analysis.business_id = '26262626-2626-4262-8262-26262626a001'
    and analysis.revenue_stream_id = '26262626-2626-4262-8262-26262626d001';

  if snapshot_name is distinct from 'Other Revenue'
    or snapshot_type is distinct from 'other' then
    raise exception 'Task 24 did not preserve the original attributed stream snapshot';
  end if;

  if analysis_name is distinct from 'Other Revenue'
    or analysis_type is distinct from 'other'
    or analysis_net is distinct from 150::numeric then
    raise exception 'Task 24 lifetime analysis did not preserve historical attribution snapshots';
  end if;
end;
$$;

rollback;

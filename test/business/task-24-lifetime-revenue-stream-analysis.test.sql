begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('24242424-2424-4242-8242-242424242001', 'task24-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('24242424-2424-4242-8242-242424242002', 'task24-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('24242424-2424-4242-8242-242424242003', 'task24-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('24242424-2424-4242-8242-242424242004', 'task24-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('24242424-2424-4242-8242-24242424a001', 'Task 24 Business A', 'EGP', 'Africa/Cairo', '24242424-2424-4242-8242-242424242001', '24242424-2424-4242-8242-24242424c001'),
  ('24242424-2424-4242-8242-24242424b002', 'Task 24 Business B', 'SAR', 'Asia/Riyadh', '24242424-2424-4242-8242-242424242002', '24242424-2424-4242-8242-24242424c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('24242424-2424-4242-8242-24242424a001', '24242424-2424-4242-8242-242424242003', 'member');

insert into public.revenue_streams (id, business_id, name, stream_type, creation_request_id)
values
  ('24242424-2424-4242-8242-24242424d001', '24242424-2424-4242-8242-24242424a001', 'Core Offer', 'front_end', '24242424-2424-4242-8242-24242424e001'),
  ('24242424-2424-4242-8242-24242424d002', '24242424-2424-4242-8242-24242424a001', 'Backend', 'backend', '24242424-2424-4242-8242-24242424e002'),
  ('24242424-2424-4242-8242-24242424d003', '24242424-2424-4242-8242-24242424b002', 'Other Business Stream', 'front_end', '24242424-2424-4242-8242-24242424e003');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"24242424-2424-4242-8242-242424242001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source('24242424-2424-4242-8242-24242424a001', 'stripe');

select public.import_customer_transactions(
  '24242424-2424-4242-8242-24242424a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"core-1","import_row_token":"24242424-2424-4242-8242-24242424f001","customer_email":"c1@example.com","transaction_date":"2026-01-05T10:00:00Z","amount_collected":"1000","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":2,"transaction_id":"backend-1","import_row_token":"24242424-2424-4242-8242-24242424f002","customer_email":"c1@example.com","transaction_date":"2026-02-05T10:00:00Z","amount_collected":"500","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":3,"transaction_id":"core-2","import_row_token":"24242424-2424-4242-8242-24242424f003","customer_email":"c2@example.com","transaction_date":"2026-01-10T10:00:00Z","amount_collected":"800","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":4,"transaction_id":"core-refund","import_row_token":"24242424-2424-4242-8242-24242424f004","customer_email":"c2@example.com","transaction_date":"2026-02-10T10:00:00Z","amount_collected":"100","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":5,"transaction_id":"unattributed","import_row_token":"24242424-2424-4242-8242-24242424f005","customer_email":"c2@example.com","transaction_date":"2026-03-10T10:00:00Z","amount_collected":"200","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"}
  ]'::jsonb
);

select public.assign_customer_transaction_revenue_stream(
  '24242424-2424-4242-8242-24242424a001',
  (select id from public.customer_transactions where business_id = '24242424-2424-4242-8242-24242424a001' and source_transaction_id = 'core-1'),
  '24242424-2424-4242-8242-24242424d001'
);
select public.assign_customer_transaction_revenue_stream(
  '24242424-2424-4242-8242-24242424a001',
  (select id from public.customer_transactions where business_id = '24242424-2424-4242-8242-24242424a001' and source_transaction_id = 'backend-1'),
  '24242424-2424-4242-8242-24242424d002'
);
select public.assign_customer_transaction_revenue_stream(
  '24242424-2424-4242-8242-24242424a001',
  (select id from public.customer_transactions where business_id = '24242424-2424-4242-8242-24242424a001' and source_transaction_id = 'core-2'),
  '24242424-2424-4242-8242-24242424d001'
);
select public.assign_customer_transaction_revenue_stream(
  '24242424-2424-4242-8242-24242424a001',
  (select id from public.customer_transactions where business_id = '24242424-2424-4242-8242-24242424a001' and source_transaction_id = 'core-refund'),
  '24242424-2424-4242-8242-24242424d001'
);

do $$
declare
  core public.customer_lifetime_revenue_stream_analysis%rowtype;
  backend public.customer_lifetime_revenue_stream_analysis%rowtype;
  unattributed public.customer_lifetime_revenue_stream_analysis%rowtype;
  lifetime_net numeric;
  observed_net numeric;
begin
  select * into core from public.customer_lifetime_revenue_stream_analysis
  where business_id = '24242424-2424-4242-8242-24242424a001'
    and revenue_stream_id = '24242424-2424-4242-8242-24242424d001';
  select * into backend from public.customer_lifetime_revenue_stream_analysis
  where business_id = '24242424-2424-4242-8242-24242424a001'
    and revenue_stream_id = '24242424-2424-4242-8242-24242424d002';
  select * into unattributed from public.customer_lifetime_revenue_stream_analysis
  where business_id = '24242424-2424-4242-8242-24242424a001'
    and is_unattributed;

  if core.gross_cash_collected <> 1800 or core.refunds <> 100 or core.net_cash_collected <> 1700
    or core.customers_with_activity <> 2 or core.revenue_stream_type <> 'front_end' then
    raise exception 'Core Offer lifetime stream values are wrong';
  end if;
  if backend.gross_cash_collected <> 500 or backend.refunds <> 0 or backend.net_cash_collected <> 500
    or backend.customers_with_activity <> 1 or backend.revenue_stream_type <> 'backend' then
    raise exception 'Backend lifetime stream values are wrong';
  end if;
  if unattributed.gross_cash_collected <> 200 or unattributed.net_cash_collected <> 200
    or not unattributed.is_unattributed then
    raise exception 'Unattributed lifetime stream values are wrong';
  end if;

  select sum(net_cash_collected) into lifetime_net
  from public.customer_lifetime_revenue_stream_analysis
  where business_id = '24242424-2424-4242-8242-24242424a001';
  select sum(cumulative_net_cash_collected) into observed_net
  from public.customer_observed_ltv
  where business_id = '24242424-2424-4242-8242-24242424a001';
  if lifetime_net <> 2400 or observed_net <> lifetime_net then
    raise exception 'Task 24 stream totals do not reconcile to current cohort Net Cash';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.assign_customer_transaction_revenue_stream(
      '24242424-2424-4242-8242-24242424a001',
      (select id from public.customer_transactions where business_id = '24242424-2424-4242-8242-24242424a001' and source_transaction_id = 'core-1'),
      '24242424-2424-4242-8242-24242424d003'
    );
    raise exception 'Cross-business revenue stream attribution unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

set local request.jwt.claims =
  '{"sub":"24242424-2424-4242-8242-242424242003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_lifetime_revenue_stream_analysis
    where business_id = '24242424-2424-4242-8242-24242424a001'
  ) then
    raise exception 'Authorized member cannot read Task 24 analysis';
  end if;

  begin
    perform public.assign_customer_transaction_revenue_stream(
      '24242424-2424-4242-8242-24242424a001',
      (select id from public.customer_transactions where business_id = '24242424-2424-4242-8242-24242424a001' limit 1),
      null
    );
    raise exception 'Non-owner member unexpectedly changed transaction attribution';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claims =
  '{"sub":"24242424-2424-4242-8242-242424242002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_lifetime_revenue_stream_analysis
    where business_id = '24242424-2424-4242-8242-24242424a001'
  ) then
    raise exception 'Owner B can read Business A Task 24 analysis';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform count(*) from public.customer_lifetime_revenue_stream_analysis;
    raise exception 'Anonymous user unexpectedly read Task 24 analysis';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.assign_customer_transaction_revenue_stream(
      '24242424-2424-4242-8242-24242424a001',
      null,
      null
    );
    raise exception 'Anonymous user unexpectedly executed Task 24 attribution RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

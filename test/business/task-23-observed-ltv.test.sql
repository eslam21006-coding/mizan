begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('23232323-2323-4232-8232-232323232001', 'task23-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('23232323-2323-4232-8232-232323232002', 'task23-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('23232323-2323-4232-8232-232323232003', 'task23-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('23232323-2323-4232-8232-232323232004', 'task23-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('23232323-2323-4232-8232-23232323a001', 'Task 23 Business A', 'EGP', 'Africa/Cairo', '23232323-2323-4232-8232-232323232001', '23232323-2323-4232-8232-23232323c001'),
  ('23232323-2323-4232-8232-23232323b002', 'Task 23 Business B', 'SAR', 'Asia/Riyadh', '23232323-2323-4232-8232-232323232002', '23232323-2323-4232-8232-23232323c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('23232323-2323-4232-8232-23232323a001', '23232323-2323-4232-8232-232323232003', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"23232323-2323-4232-8232-232323232001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source(
  '23232323-2323-4232-8232-23232323a001',
  'stripe'
);

select public.import_customer_transactions(
  '23232323-2323-4232-8232-23232323a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"jan-c1","import_row_token":"23232323-2323-4232-8232-23232323e001","customer_email":"c1@example.com","transaction_date":"2026-01-01T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":2,"transaction_id":"jan-c2","import_row_token":"23232323-2323-4232-8232-23232323e002","customer_email":"c2@example.com","transaction_date":"2026-01-02T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":3,"transaction_id":"jan-c3","import_row_token":"23232323-2323-4232-8232-23232323e003","customer_email":"c3@example.com","transaction_date":"2026-01-03T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":4,"transaction_id":"jan-c4","import_row_token":"23232323-2323-4232-8232-23232323e004","customer_email":"c4@example.com","transaction_date":"2026-01-04T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":5,"transaction_id":"feb-extra","import_row_token":"23232323-2323-4232-8232-23232323e005","customer_email":"c1@example.com","transaction_date":"2026-02-05T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":6,"transaction_id":"mar-refund","import_row_token":"23232323-2323-4232-8232-23232323e006","customer_email":"c2@example.com","transaction_date":"2026-03-05T10:00:00Z","amount_collected":"80","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":7,"transaction_id":"apr-refund","import_row_token":"23232323-2323-4232-8232-23232323e007","customer_email":"c3@example.com","transaction_date":"2026-04-05T10:00:00Z","amount_collected":"500","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"}
  ]'::jsonb
);

do $$
declare
  march public.customer_cohort_observations%rowtype;
  april public.customer_cohort_observations%rowtype;
  current_snapshot public.customer_observed_ltv%rowtype;
begin
  select * into march
  from public.customer_cohort_observations
  where business_id = '23232323-2323-4232-8232-23232323a001'
    and cohort_month = '2026-01-01'::date
    and observation_month = '2026-03-01'::date;

  if not found then
    raise exception 'March observation for January cohort is missing';
  end if;

  if march.original_cohort_size <> 4
    or march.cumulative_gross_cash_collected <> 500
    or march.cumulative_refunds <> 80
    or march.cumulative_net_cash_collected <> 420
    or march.observed_ltv <> 105
    or march.cohort_age_months <> 2
    or march.months_observed <> 3 then
    raise exception 'Example J values are wrong: size %, gross %, refunds %, net %, LTV %, age %, months %',
      march.original_cohort_size,
      march.cumulative_gross_cash_collected,
      march.cumulative_refunds,
      march.cumulative_net_cash_collected,
      march.observed_ltv,
      march.cohort_age_months,
      march.months_observed;
  end if;

  if march.cumulative_net_cash_collected_text <> '420'
    or march.observed_ltv_text <> '105' then
    raise exception 'Example J exact transport text is wrong: net %, LTV %',
      march.cumulative_net_cash_collected_text,
      march.observed_ltv_text;
  end if;

  select * into april
  from public.customer_cohort_observations
  where business_id = '23232323-2323-4232-8232-23232323a001'
    and cohort_month = '2026-01-01'::date
    and observation_month = '2026-04-01'::date;

  if not found then
    raise exception 'April observation for January cohort is missing';
  end if;

  if april.original_cohort_size <> 4
    or april.cumulative_gross_cash_collected <> 500
    or april.cumulative_refunds <> 580
    or april.cumulative_net_cash_collected <> -80
    or april.observed_ltv <> -20
    or april.cohort_age_months <> 3
    or april.months_observed <> 4 then
    raise exception 'refund-heavy Observed LTV did not decline correctly';
  end if;

  if april.cumulative_net_cash_collected_text <> '-80'
    or april.observed_ltv_text <> '-20' then
    raise exception 'negative Observed LTV exact transport text is wrong';
  end if;

  select * into current_snapshot
  from public.customer_observed_ltv
  where business_id = '23232323-2323-4232-8232-23232323a001'
    and cohort_month = '2026-01-01'::date;

  if not found
    or current_snapshot.original_cohort_size <> 4
    or current_snapshot.cumulative_net_cash_collected <> -80
    or current_snapshot.observed_ltv <> -20 then
    raise exception 'current Observed LTV snapshot is not cumulative through the latest persisted history';
  end if;

  if current_snapshot.observation_cutoff_date > (current_timestamp at time zone 'Africa/Cairo')::date then
    raise exception 'current observation cutoff extends into the future';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"23232323-2323-4232-8232-232323232002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_cohort_observations
    where business_id = '23232323-2323-4232-8232-23232323a001'
  ) then
    raise exception 'owner B can read business A cohort observations';
  end if;

  if exists (
    select 1 from public.customer_observed_ltv
    where business_id = '23232323-2323-4232-8232-23232323a001'
  ) then
    raise exception 'owner B can read business A current Observed LTV';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"23232323-2323-4232-8232-232323232003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_observed_ltv
    where business_id = '23232323-2323-4232-8232-23232323a001'
      and cohort_month = '2026-01-01'::date
  ) then
    raise exception 'authorized member cannot read current Observed LTV';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"23232323-2323-4232-8232-232323232004","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_observed_ltv
    where business_id = '23232323-2323-4232-8232-23232323a001'
      and cohort_month = '2026-01-01'::date
  ) then
    raise exception 'admin cannot read current Observed LTV';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform count(*) from public.customer_cohort_observations;
    raise exception 'anonymous user unexpectedly read cohort observations';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.customer_observed_ltv;
    raise exception 'anonymous user unexpectedly read current Observed LTV';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

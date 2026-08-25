begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('22222222-2222-4222-8222-222222222001', 'task22-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222002', 'task22-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222003', 'task22-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222004', 'task22-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('22222222-2222-4222-8222-22222222a001', 'Task 22 Business A', 'EGP', 'Africa/Cairo', '22222222-2222-4222-8222-222222222001', '22222222-2222-4222-8222-22222222c001'),
  ('22222222-2222-4222-8222-22222222b002', 'Task 22 Business B', 'SAR', 'Asia/Riyadh', '22222222-2222-4222-8222-222222222002', '22222222-2222-4222-8222-22222222c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('22222222-2222-4222-8222-22222222a001', '22222222-2222-4222-8222-222222222003', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source(
  '22222222-2222-4222-8222-22222222a001',
  'stripe'
);

select public.import_customer_transactions(
  '22222222-2222-4222-8222-22222222a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"jan-c1","import_row_token":"22222222-2222-4222-8222-22222222e001","customer_email":"c1@example.com","transaction_date":"2026-01-01T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":2,"transaction_id":"jan-c2","import_row_token":"22222222-2222-4222-8222-22222222e002","customer_email":"c2@example.com","transaction_date":"2026-01-02T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":3,"transaction_id":"jan-c3","import_row_token":"22222222-2222-4222-8222-22222222e003","customer_email":"c3@example.com","transaction_date":"2026-01-03T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":4,"transaction_id":"jan-c4","import_row_token":"22222222-2222-4222-8222-22222222e004","customer_email":"c4@example.com","transaction_date":"2026-01-04T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":5,"transaction_id":"feb-upsell","import_row_token":"22222222-2222-4222-8222-22222222e005","customer_email":"c1@example.com","transaction_date":"2026-02-05T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":6,"transaction_id":"mar-refund","import_row_token":"22222222-2222-4222-8222-22222222e006","customer_email":"c2@example.com","transaction_date":"2026-03-05T10:00:00Z","amount_collected":"80","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":7,"transaction_id":"feb-c5","import_row_token":"22222222-2222-4222-8222-22222222e007","customer_email":"c5@example.com","transaction_date":"2026-02-10T10:00:00Z","amount_collected":"50","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":8,"transaction_id":"refund-only","import_row_token":"22222222-2222-4222-8222-22222222e008","customer_email":"refund-only@example.com","transaction_date":"2026-01-06T10:00:00Z","amount_collected":"25","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"}
  ]'::jsonb
);

do $$
declare
  january_size bigint;
  february_size bigint;
  january_activity public.customer_cohort_monthly_activity%rowtype;
  february_activity public.customer_cohort_monthly_activity%rowtype;
  march_activity public.customer_cohort_monthly_activity%rowtype;
begin
  select count(*)::bigint into january_size
  from public.customer_acquisition_cohorts
  where business_id = '22222222-2222-4222-8222-22222222a001'
    and cohort_month = '2026-01-01'::date;

  select count(*)::bigint into february_size
  from public.customer_acquisition_cohorts
  where business_id = '22222222-2222-4222-8222-22222222a001'
    and cohort_month = '2026-02-01'::date;

  if january_size <> 4 or february_size <> 1 then
    raise exception 'cohort membership counts are wrong: January %, February %', january_size, february_size;
  end if;

  if exists (
    select 1
    from public.customer_acquisition_cohorts
    where business_id = '22222222-2222-4222-8222-22222222a001'
      and customer_email = 'refund-only@example.com'
  ) then
    raise exception 'refund-only customer was incorrectly assigned to an acquisition cohort';
  end if;

  if (
    select cohort_month
    from public.customer_acquisition_cohorts
    where business_id = '22222222-2222-4222-8222-22222222a001'
      and customer_email = 'c1@example.com'
  ) <> '2026-01-01'::date then
    raise exception 'later February purchase reset c1 acquisition cohort';
  end if;

  select * into january_activity
  from public.customer_cohort_monthly_activity
  where business_id = '22222222-2222-4222-8222-22222222a001'
    and cohort_month = '2026-01-01'::date
    and activity_month = '2026-01-01'::date;

  if not found
    or january_activity.original_cohort_size <> 4
    or january_activity.gross_cash_collected <> 400
    or january_activity.refunds <> 0
    or january_activity.net_cash_collected <> 400
    or january_activity.gross_cash_collected_text <> '400'
    or january_activity.net_cash_collected_text <> '400' then
    raise exception 'January cohort M0 activity is incorrect';
  end if;

  select * into february_activity
  from public.customer_cohort_monthly_activity
  where business_id = '22222222-2222-4222-8222-22222222a001'
    and cohort_month = '2026-01-01'::date
    and activity_month = '2026-02-01'::date;

  if not found
    or february_activity.original_cohort_size <> 4
    or february_activity.gross_cash_collected <> 100
    or february_activity.refunds <> 0
    or february_activity.net_cash_collected <> 100 then
    raise exception 'January cohort February activity is incorrect';
  end if;

  select * into march_activity
  from public.customer_cohort_monthly_activity
  where business_id = '22222222-2222-4222-8222-22222222a001'
    and cohort_month = '2026-01-01'::date
    and activity_month = '2026-03-01'::date;

  if not found
    or march_activity.original_cohort_size <> 4
    or march_activity.gross_cash_collected <> 0
    or march_activity.refunds <> 80
    or march_activity.net_cash_collected <> -80
    or march_activity.refunds_text <> '80'
    or march_activity.net_cash_collected_text <> '-80' then
    raise exception 'January cohort March refund activity is incorrect';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_acquisition_cohorts
    where business_id = '22222222-2222-4222-8222-22222222a001'
  ) then
    raise exception 'owner B can read business A cohort membership';
  end if;

  if exists (
    select 1 from public.customer_cohort_monthly_activity
    where business_id = '22222222-2222-4222-8222-22222222a001'
  ) then
    raise exception 'owner B can read business A cohort monthly activity';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.customer_acquisition_cohorts
      where business_id = '22222222-2222-4222-8222-22222222a001') <> 5 then
    raise exception 'authorized member cannot read business A cohorts';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222004","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if (select count(*) from public.customer_acquisition_cohorts
      where business_id = '22222222-2222-4222-8222-22222222a001') <> 5 then
    raise exception 'admin cannot read business A cohorts';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform count(*) from public.customer_acquisition_cohorts;
    raise exception 'anonymous user unexpectedly read acquisition cohorts';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.customer_cohort_monthly_activity;
    raise exception 'anonymous user unexpectedly read cohort monthly activity';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

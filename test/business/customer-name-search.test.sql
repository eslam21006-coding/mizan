begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at) values
('67676767-6767-4767-8767-676767676001', 'search-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
('67676767-6767-4767-8767-676767676002', 'search-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id) values
('67676767-6767-4767-8767-67676767a001', 'Search Business A', 'EGP', 'Africa/Cairo', '67676767-6767-4767-8767-676767676001', '67676767-6767-4767-8767-67676767c001'),
('67676767-6767-4767-8767-67676767b002', 'Search Business B', 'EGP', 'Africa/Cairo', '67676767-6767-4767-8767-676767676002', '67676767-6767-4767-8767-67676767c002');

set local role authenticated;
set local request.jwt.claims = '{"sub":"67676767-6767-4767-8767-676767676001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source('67676767-6767-4767-8767-67676767a001', 'stripe');

select public.import_customer_transactions(
  '67676767-6767-4767-8767-67676767a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"txn-search-name","import_row_token":"67676767-6767-4767-8767-67676767e001","customer_email":"buyer@example.com","transaction_date":"2026-09-08T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":2,"transaction_id":"txn-search-email","import_row_token":"67676767-6767-4767-8767-67676767e002","customer_email":"unnamed@example.com","transaction_date":"2026-09-08T11:00:00Z","amount_collected":"75","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"}
  ]'::jsonb
);

select public.apply_customer_transaction_names(
  '67676767-6767-4767-8767-67676767a001',
  'stripe',
  '[{"transaction_id":"txn-search-name","import_row_token":"67676767-6767-4767-8767-67676767e001","customer_email":"buyer@example.com","customer_name":"Ahmed Buyer"}]'::jsonb
);

do $$
declare
  named_count integer;
  email_count integer;
  unnamed_count integer;
  grouped public.customer_transaction_groups%rowtype;
begin
  select count(*) into named_count
  from public.customer_transaction_groups
  where business_id = '67676767-6767-4767-8767-67676767a001'
    and customer_search_text ilike '%ahmed buyer%';

  if named_count <> 1 then
    raise exception 'customer name search did not return the named customer';
  end if;

  select count(*) into email_count
  from public.customer_transaction_groups
  where business_id = '67676767-6767-4767-8767-67676767a001'
    and customer_search_text ilike '%BUYER@EXAMPLE.COM%';

  if email_count <> 1 then
    raise exception 'customer email search stopped working for a named customer';
  end if;

  select count(*) into unnamed_count
  from public.customer_transaction_groups
  where business_id = '67676767-6767-4767-8767-67676767a001'
    and customer_search_text ilike '%unnamed@example.com%';

  if unnamed_count <> 1 then
    raise exception 'email fallback search stopped working for an unnamed customer';
  end if;

  select * into grouped
  from public.customer_transaction_groups
  where business_id = '67676767-6767-4767-8767-67676767a001'
    and customer_email = 'buyer@example.com';

  if grouped.customer_name <> 'Ahmed Buyer' then
    raise exception 'customer display name changed unexpectedly';
  end if;
  if grouped.customer_email <> 'buyer@example.com' then
    raise exception 'customer email identity changed unexpectedly';
  end if;
  if grouped.transaction_count <> 1 or grouped.net_cash_collected <> 100 then
    raise exception 'search projection changed customer financial grouping';
  end if;
end $$;

set local request.jwt.claims = '{"sub":"67676767-6767-4767-8767-676767676002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (
    select count(*)
    from public.customer_transaction_groups
    where business_id = '67676767-6767-4767-8767-67676767a001'
      and customer_search_text ilike '%Ahmed Buyer%'
  ) <> 0 then
    raise exception 'other owner can search another business customer metadata';
  end if;
end $$;

rollback;

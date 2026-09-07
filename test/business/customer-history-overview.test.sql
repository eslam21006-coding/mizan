begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('71717171-7171-4717-8717-717171717001', 'history-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('71717171-7171-4717-8717-717171717002', 'history-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('71717171-7171-4717-8717-717171717003', 'history-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('71717171-7171-4717-8717-717171717004', 'history-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('71717171-7171-4717-8717-717171717005', 'history-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('71717171-aaaa-4717-8717-717171717001', 'History Overview A', 'USD', 'Africa/Cairo', '71717171-7171-4717-8717-717171717001', '71717171-bbbb-4717-8717-717171717001'),
  ('71717171-aaaa-4717-8717-717171717002', 'History Overview B', 'SAR', 'Asia/Riyadh', '71717171-7171-4717-8717-717171717002', '71717171-bbbb-4717-8717-717171717002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('71717171-aaaa-4717-8717-717171717001', '71717171-7171-4717-8717-717171717003', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171717001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source('71717171-aaaa-4717-8717-717171717001', 'gateway');
select public.import_customer_transactions(
  '71717171-aaaa-4717-8717-717171717001',
  'gateway',
  '[
    {"row_number":1,"transaction_id":"alice-first","import_row_token":"71717171-0000-4000-8000-000000000001","customer_email":"alice@example.test","transaction_date":"2026-01-01T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"},
    {"row_number":2,"transaction_id":"alice-repeat","import_row_token":"71717171-0000-4000-8000-000000000002","customer_email":"alice@example.test","transaction_date":"2026-02-01T10:00:00Z","amount_collected":"50","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"},
    {"row_number":3,"transaction_id":"alice-refund","import_row_token":"71717171-0000-4000-8000-000000000003","customer_email":"alice@example.test","transaction_date":"2026-02-02T10:00:00Z","amount_collected":"20","transaction_type":"refund","normalized_outcome":"successful","currency":"USD"},
    {"row_number":4,"transaction_id":"bob-first","import_row_token":"71717171-0000-4000-8000-000000000004","customer_email":"bob@example.test","transaction_date":"2026-03-01T10:00:00Z","amount_collected":"70","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"},
    {"row_number":5,"transaction_id":"charlie-refund-only","import_row_token":"71717171-0000-4000-8000-000000000005","customer_email":"charlie@example.test","transaction_date":"2026-03-02T10:00:00Z","amount_collected":"10","transaction_type":"refund","normalized_outcome":"successful","currency":"USD"}
  ]'::jsonb
);

do $$
declare
  overview public.customer_history_overview%rowtype;
begin
  select * into overview
  from public.customer_history_overview
  where business_id = '71717171-aaaa-4717-8717-717171717001';

  if not found then
    raise exception 'owner cannot read the customer history overview';
  end if;
  if overview.paying_customer_count <> 2
    or overview.repeat_customer_count <> 1 then
    raise exception 'paying/repeat customer counts are wrong: %, %', overview.paying_customer_count, overview.repeat_customer_count;
  end if;
  if overview.gross_cash_collected <> 220
    or overview.refunds <> 30
    or overview.net_cash_collected <> 190 then
    raise exception 'historical cash totals are wrong: gross %, refunds %, net %', overview.gross_cash_collected, overview.refunds, overview.net_cash_collected;
  end if;
  if overview.revenue_per_paying_customer <> 95 then
    raise exception 'Revenue per Paying Customer must be 190 / 2 = 95, got %', overview.revenue_per_paying_customer;
  end if;
  if overview.paying_customer_count_text <> '2'
    or overview.repeat_customer_count_text <> '1'
    or overview.gross_cash_collected_text <> '220'
    or overview.refunds_text <> '30'
    or overview.net_cash_collected_text <> '190'
    or overview.revenue_per_paying_customer_text <> '95' then
    raise exception 'exact overview transport text is wrong';
  end if;
end $$;

set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171717002","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source('71717171-aaaa-4717-8717-717171717002', 'gateway');
select public.import_customer_transactions(
  '71717171-aaaa-4717-8717-717171717002',
  'gateway',
  '[{"row_number":1,"transaction_id":"business-b","import_row_token":"71717171-0000-4000-8000-000000000101","customer_email":"other@example.test","transaction_date":"2026-01-01T10:00:00Z","amount_collected":"999","transaction_type":"collection","normalized_outcome":"successful","currency":"SAR"}]'::jsonb
);

do $$
begin
  if (select count(*) from public.customer_history_overview where business_id = '71717171-aaaa-4717-8717-717171717001') <> 0 then
    raise exception 'owner B can read business A customer history overview';
  end if;
  if (select net_cash_collected_text from public.customer_history_overview where business_id = '71717171-aaaa-4717-8717-717171717002') <> '999' then
    raise exception 'owner B cannot read its own isolated overview';
  end if;
end $$;

set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171717003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.customer_history_overview where business_id = '71717171-aaaa-4717-8717-717171717001') <> 1 then
    raise exception 'authorized member cannot read business A overview';
  end if;
  if (select count(*) from public.customer_history_overview where business_id = '71717171-aaaa-4717-8717-717171717002') <> 0 then
    raise exception 'business A member can read business B overview';
  end if;
end $$;

set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171717004","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.customer_history_overview) <> 0 then
    raise exception 'unrelated mentee can read customer history overview rows';
  end if;
end $$;

set local request.jwt.claims =
  '{"sub":"71717171-7171-4717-8717-717171717005","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if (select count(*) from public.customer_history_overview where business_id in (
    '71717171-aaaa-4717-8717-717171717001',
    '71717171-aaaa-4717-8717-717171717002'
  )) <> 2 then
    raise exception 'admin cannot read both authorized business overviews';
  end if;
end $$;

reset role;
set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform count(*) from public.customer_history_overview;
    raise exception 'anonymous user unexpectedly read customer history overview';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;

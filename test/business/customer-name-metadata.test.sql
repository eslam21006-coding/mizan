begin;
insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at) values
('66666666-6666-4666-8666-666666666001', 'name-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
('66666666-6666-4666-8666-666666666002', 'name-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now());
insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id) values
('66666666-6666-4666-8666-66666666a001', 'Name Metadata A', 'EGP', 'Africa/Cairo', '66666666-6666-4666-8666-666666666001', '66666666-6666-4666-8666-66666666c001'),
('66666666-6666-4666-8666-66666666b002', 'Name Metadata B', 'EGP', 'Africa/Cairo', '66666666-6666-4666-8666-666666666002', '66666666-6666-4666-8666-66666666c002');
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source('66666666-6666-4666-8666-66666666a001', 'stripe');
select public.import_customer_transactions('66666666-6666-4666-8666-66666666a001', 'stripe', '[{"row_number":1,"transaction_id":"txn-name-1","import_row_token":"66666666-6666-4666-8666-66666666e001","customer_email":"buyer@example.com","transaction_date":"2026-09-08T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"}]'::jsonb);
select public.apply_customer_transaction_names('66666666-6666-4666-8666-66666666a001', 'stripe', '[{"transaction_id":"txn-name-1","import_row_token":"66666666-6666-4666-8666-66666666e001","customer_email":"buyer@example.com","customer_name":"Ahmed Buyer"}]'::jsonb);
do $$ declare grouped public.customer_transaction_groups%rowtype; begin
select * into grouped from public.customer_transaction_groups where business_id='66666666-6666-4666-8666-66666666a001' and customer_email='buyer@example.com';
if grouped.customer_name <> 'Ahmed Buyer' then raise exception 'customer name metadata missing'; end if;
if grouped.transaction_count <> 1 or grouped.net_cash_collected <> 100 then raise exception 'name metadata changed financial grouping'; end if;
end $$;
select public.apply_customer_transaction_names('66666666-6666-4666-8666-66666666a001', 'stripe', '[{"transaction_id":"txn-name-1","import_row_token":"66666666-6666-4666-8666-66666666e001","customer_email":"buyer@example.com","customer_name":"Different Name"}]'::jsonb);
do $$ begin if (select customer_name from public.customer_transactions where business_id='66666666-6666-4666-8666-66666666a001' and source_transaction_id='txn-name-1') <> 'Ahmed Buyer' then raise exception 'name retry overwrote metadata'; end if; end $$;
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666002","role":"authenticated","app_metadata":{"role":"mentee"}}';
do $$ begin
begin perform public.apply_customer_transaction_names('66666666-6666-4666-8666-66666666a001','stripe','[{"transaction_id":"txn-name-1","import_row_token":"66666666-6666-4666-8666-66666666e001","customer_email":"buyer@example.com","customer_name":"Unauthorized"}]'::jsonb); raise exception 'other owner changed name metadata'; exception when insufficient_privilege then null; end;
if (select count(*) from public.customer_transaction_groups where business_id='66666666-6666-4666-8666-66666666a001') <> 0 then raise exception 'other owner can read name metadata'; end if;
end $$;
set local role anon;
set local request.jwt.claims = '{}';
do $$ begin begin perform public.apply_customer_transaction_names('66666666-6666-4666-8666-66666666a001','stripe','[]'::jsonb); raise exception 'anon executed name RPC'; exception when insufficient_privilege then null; end; end $$;
rollback;

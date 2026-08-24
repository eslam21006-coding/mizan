begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('20202020-2020-4020-8020-202020202001', 'task20-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('20202020-2020-4020-8020-202020202002', 'task20-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('20202020-2020-4020-8020-202020202003', 'task20-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('20202020-2020-4020-8020-202020202004', 'task20-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('20202020-2020-4020-8020-20202020a001', 'Task 20 Business A', 'EGP', 'Africa/Cairo', '20202020-2020-4020-8020-202020202001', '20202020-2020-4020-8020-20202020c001'),
  ('20202020-2020-4020-8020-20202020b002', 'Task 20 Business B', 'SAR', 'Asia/Riyadh', '20202020-2020-4020-8020-202020202002', '20202020-2020-4020-8020-20202020c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('20202020-2020-4020-8020-20202020a001', '20202020-2020-4020-8020-202020202003', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20202020-2020-4020-8020-202020202001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  first_result jsonb;
  second_result jsonb;
  other_source_result jsonb;
  total_amount numeric;
begin
  first_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    ' Stripe ',
    '[
      {"row_number":1,"transaction_id":null,"customer_email":" Buyer@Example.com ","transaction_date":"2026-08-24","amount_collected":"100.00"},
      {"row_number":2,"transaction_id":null,"customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100"},
      {"row_number":3,"transaction_id":" txn_123 ","customer_email":"second@example.com","transaction_date":"2026-08-24","amount_collected":"200"},
      {"row_number":4,"transaction_id":"txn_123","customer_email":"changed@example.com","transaction_date":"2026-08-25","amount_collected":"999"}
    ]'::jsonb
  );

  if (first_result ->> 'inserted_count')::integer <> 2
    or (first_result ->> 'duplicate_count')::integer <> 2 then
    raise exception 'first import did not distinguish new and duplicate rows: %', first_result;
  end if;

  select coalesce(sum(amount_collected), 0)
  into total_amount
  from public.customer_transactions
  where business_id = '20202020-2020-4020-8020-20202020a001'
    and source = 'stripe';

  if total_amount <> 300 then
    raise exception 'first import persisted wrong cash total: %', total_amount;
  end if;

  second_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[
      {"row_number":1,"transaction_id":null,"customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100"},
      {"row_number":2,"transaction_id":null,"customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100.00"},
      {"row_number":3,"transaction_id":"txn_123","customer_email":"second@example.com","transaction_date":"2026-08-24","amount_collected":"200"},
      {"row_number":4,"transaction_id":"txn_123","customer_email":"changed@example.com","transaction_date":"2026-08-25","amount_collected":"999"}
    ]'::jsonb
  );

  if (second_result ->> 'inserted_count')::integer <> 0
    or (second_result ->> 'duplicate_count')::integer <> 4 then
    raise exception 'second identical import was not fully deduplicated: %', second_result;
  end if;

  select coalesce(sum(amount_collected), 0)
  into total_amount
  from public.customer_transactions
  where business_id = '20202020-2020-4020-8020-20202020a001'
    and source = 'stripe';

  if total_amount <> 300 then
    raise exception 're-import doubled revenue/cash total: %', total_amount;
  end if;

  other_source_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'PayPal',
    '[
      {"row_number":1,"transaction_id":null,"customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100"},
      {"row_number":2,"transaction_id":"txn_123","customer_email":"second@example.com","transaction_date":"2026-08-24","amount_collected":"200"}
    ]'::jsonb
  );

  if (other_source_result ->> 'inserted_count')::integer <> 2
    or (other_source_result ->> 'duplicate_count')::integer <> 0 then
    raise exception 'duplicate identity leaked across transaction sources: %', other_source_result;
  end if;
end $$;

do $$
begin
  begin
    insert into public.customer_transactions (
      business_id, source, customer_email, transaction_date, amount_collected,
      source_row_number, imported_by_user_id
    ) values (
      '20202020-2020-4020-8020-20202020a001', 'stripe', 'bypass@example.com', '2026-08-24', 10,
      99, '20202020-2020-4020-8020-202020202001'
    );
    raise exception 'authenticated owner bypassed guarded import RPC with direct insert';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"20202020-2020-4020-8020-202020202002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1
    from public.customer_transactions
    where business_id = '20202020-2020-4020-8020-20202020a001'
  ) then
    raise exception 'owner B read owner A customer transactions';
  end if;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"row_number":1,"transaction_id":"blocked","customer_email":"blocked@example.com","transaction_date":"2026-08-24","amount_collected":"1"}]'::jsonb
    );
    raise exception 'owner B imported into owner A business';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"20202020-2020-4020-8020-202020202003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.customer_transactions where business_id = '20202020-2020-4020-8020-20202020a001') <> 4 then
    raise exception 'read-only business member could not read permitted transaction history';
  end if;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"row_number":1,"transaction_id":"member-blocked","customer_email":"member@example.com","transaction_date":"2026-08-24","amount_collected":"1"}]'::jsonb
    );
    raise exception 'read-only business member imported transactions';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"20202020-2020-4020-8020-202020202004","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
declare
  admin_result jsonb;
begin
  admin_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020b002',
    'Stripe',
    '[{"row_number":1,"transaction_id":"admin-txn","customer_email":"admin@example.com","transaction_date":"2026-08-24","amount_collected":"50"}]'::jsonb
  );

  if (admin_result ->> 'inserted_count')::integer <> 1 then
    raise exception 'admin could not import into managed business: %', admin_result;
  end if;

  if (select count(*) from public.customer_transactions) <> 5 then
    raise exception 'admin could not read all protected transactions';
  end if;
end $$;

rollback;

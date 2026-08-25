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
  resolve_duplicate_result jsonb;
  keep_distinct_result jsonb;
  keep_distinct_retry_result jsonb;
  retry_insert_result jsonb;
  retry_replay_result jsonb;
  id_insert_result jsonb;
  no_id_reimport_result jsonb;
  collection_result jsonb;
  refund_result jsonb;
  reimport_result jsonb;
  other_source_result jsonb;
  total_amount numeric;
begin
  if public.create_customer_transaction_source(
    '20202020-2020-4020-8020-20202020a001',
    ' Stripe '
  ) <> 'stripe' then
    raise exception 'canonical source creation did not normalize Stripe';
  end if;

  perform public.create_customer_transaction_source(
    '20202020-2020-4020-8020-20202020a001',
    'PayPal'
  );

  if (select count(*) from public.customer_transaction_sources
      where business_id = '20202020-2020-4020-8020-20202020a001') <> 2 then
    raise exception 'canonical source registry did not preserve two explicit sources';
  end if;

  first_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[
      {"row_number":1,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e001","customer_email":" Buyer@Example.com ","transaction_date":"2026-08-24","amount_collected":"100.00","transaction_type":"collection"},
      {"row_number":2,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e002","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100","transaction_type":"collection"},
      {"row_number":3,"transaction_id":" txn_123 ","import_row_token":"20202020-2020-4020-8020-20202020e003","customer_email":"second@example.com","transaction_date":"2026-08-24","amount_collected":"200","transaction_type":"collection"},
      {"row_number":4,"transaction_id":"txn_123","import_row_token":"20202020-2020-4020-8020-20202020e004","customer_email":"changed@example.com","transaction_date":"2026-08-25","amount_collected":"999","transaction_type":"collection"}
    ]'::jsonb
  );

  if (first_result ->> 'inserted_count')::integer <> 2
    or (first_result ->> 'duplicate_count')::integer <> 1
    or (first_result ->> 'candidate_count')::integer <> 1 then
    raise exception 'first import did not separate definitive duplicates from candidate collisions: %', first_result;
  end if;

  if first_result -> 'candidate_collisions' -> 0 ->> 'row_number' <> '2'
    or first_result -> 'candidate_collisions' -> 0 ->> 'existing_count' <> '1' then
    raise exception 'scale-equivalent 100 and 100.00 did not share one candidate identity: %', first_result;
  end if;

  select coalesce(sum(amount_collected), 0)
  into total_amount
  from public.customer_transactions
  where business_id = '20202020-2020-4020-8020-20202020a001'
    and source = 'stripe';

  if total_amount <> 300 then
    raise exception 'candidate collision affected cash before explicit resolution: %', total_amount;
  end if;

  resolve_duplicate_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":2,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e002","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100","transaction_type":"collection","candidate_resolution":"duplicate","candidate_resolution_id":"20202020-2020-4020-8020-20202020d001"}]'::jsonb
  );

  if (resolve_duplicate_result ->> 'duplicate_count')::integer <> 1 then
    raise exception 'explicit duplicate resolution failed: %', resolve_duplicate_result;
  end if;

  keep_distinct_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":5,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e005","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100.0","transaction_type":"collection","candidate_resolution":"keep_distinct","candidate_resolution_id":"20202020-2020-4020-8020-20202020d002"}]'::jsonb
  );

  if (keep_distinct_result ->> 'inserted_count')::integer <> 1 then
    raise exception 'keep-distinct candidate resolution failed: %', keep_distinct_result;
  end if;

  keep_distinct_retry_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":5,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e005","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100","transaction_type":"collection","candidate_resolution":"keep_distinct","candidate_resolution_id":"20202020-2020-4020-8020-20202020d002"}]'::jsonb
  );

  if (keep_distinct_retry_result ->> 'inserted_count')::integer <> 1 then
    raise exception 'resolution-token retry did not replay keep-distinct result: %', keep_distinct_retry_result;
  end if;

  retry_insert_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":50,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e050","customer_email":"retry@example.com","transaction_date":"2026-08-24","amount_collected":"75","transaction_type":"collection"}]'::jsonb
  );
  retry_replay_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":50,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e050","customer_email":"retry@example.com","transaction_date":"2026-08-24","amount_collected":"75.00","transaction_type":"collection"}]'::jsonb
  );

  if (retry_insert_result ->> 'inserted_count')::integer <> 1
    or (retry_replay_result ->> 'inserted_count')::integer <> 1
    or (select count(*) from public.customer_transactions
        where business_id = '20202020-2020-4020-8020-20202020a001'
          and import_row_token = '20202020-2020-4020-8020-20202020e050') <> 1 then
    raise exception 'lost-response row retry identity did not replay exactly one committed transaction';
  end if;

  id_insert_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":60,"transaction_id":"id-preserved","import_row_token":"20202020-2020-4020-8020-20202020e060","customer_email":"id-fallback@example.com","transaction_date":"2026-08-26","amount_collected":"60","transaction_type":"collection"}]'::jsonb
  );
  no_id_reimport_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":61,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e061","customer_email":"id-fallback@example.com","transaction_date":"2026-08-26","amount_collected":"60.00","transaction_type":"collection"}]'::jsonb
  );

  if (id_insert_result ->> 'inserted_count')::integer <> 1
    or (no_id_reimport_result ->> 'candidate_count')::integer <> 1 then
    raise exception 'ID-bearing transaction was not included in later no-ID candidate lookup: %, %', id_insert_result, no_id_reimport_result;
  end if;

  perform public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":61,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e061","customer_email":"id-fallback@example.com","transaction_date":"2026-08-26","amount_collected":"60","transaction_type":"collection","candidate_resolution":"duplicate","candidate_resolution_id":"20202020-2020-4020-8020-20202020d004"}]'::jsonb
  );

  collection_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":70,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e070","customer_email":"type@example.com","transaction_date":"2026-08-27","amount_collected":"40","transaction_type":"collection"}]'::jsonb
  );
  refund_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":71,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e071","customer_email":"type@example.com","transaction_date":"2026-08-27","amount_collected":"-40","transaction_type":"refund"}]'::jsonb
  );

  if (collection_result ->> 'inserted_count')::integer <> 1
    or (refund_result ->> 'inserted_count')::integer <> 1
    or (refund_result ->> 'candidate_count')::integer <> 0 then
    raise exception 'collection/refund transaction types collided or refund magnitude was not accepted: %, %', collection_result, refund_result;
  end if;

  if (select amount_collected from public.customer_transactions
      where import_row_token = '20202020-2020-4020-8020-20202020e071') <> 40 then
    raise exception 'refund amount was not normalized to a positive magnitude';
  end if;

  reimport_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":101,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e101","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100","transaction_type":"collection"}]'::jsonb
  );

  if (reimport_result ->> 'candidate_count')::integer <> 1
    or reimport_result -> 'candidate_collisions' -> 0 ->> 'existing_count' <> '2' then
    raise exception 're-import did not surface existing no-ID purchases as candidates: %', reimport_result;
  end if;

  perform public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'stripe',
    '[{"row_number":101,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e101","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100","transaction_type":"collection","candidate_resolution":"duplicate","candidate_resolution_id":"20202020-2020-4020-8020-20202020d003"}]'::jsonb
  );

  other_source_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020a001',
    'paypal',
    '[
      {"row_number":201,"transaction_id":null,"import_row_token":"20202020-2020-4020-8020-20202020e201","customer_email":"buyer@example.com","transaction_date":"2026-08-24","amount_collected":"100","transaction_type":"collection"},
      {"row_number":202,"transaction_id":"txn_123","import_row_token":"20202020-2020-4020-8020-20202020e202","customer_email":"second@example.com","transaction_date":"2026-08-24","amount_collected":"200","transaction_type":"collection"}
    ]'::jsonb
  );

  if (other_source_result ->> 'inserted_count')::integer <> 2
    or (other_source_result ->> 'duplicate_count')::integer <> 0
    or (other_source_result ->> 'candidate_count')::integer <> 0 then
    raise exception 'candidate or definitive identity leaked across registered sources: %', other_source_result;
  end if;

  if (select count(*) from public.customer_transactions
      where business_id = '20202020-2020-4020-8020-20202020a001') <> 9 then
    raise exception 'unexpected Task 20 transaction count after duplicate/candidate tests';
  end if;

  if (select count(*) from public.customer_transaction_duplicate_resolutions
      where business_id = '20202020-2020-4020-8020-20202020a001') <> 4 then
    raise exception 'candidate duplicate decisions were not preserved exactly once for audit';
  end if;

  select coalesce(sum(amount_collected), 0)
  into total_amount
  from public.customer_transactions
  where business_id = '20202020-2020-4020-8020-20202020a001'
    and source = 'stripe';

  if total_amount <> 615 then
    raise exception 'stripe stored amount magnitudes were duplicated or lost: %', total_amount;
  end if;
end $$;

do $$
begin
  begin
    perform public.create_customer_transaction_source(
      '20202020-2020-4020-8020-20202020a001',
      repeat('x', 81)
    );
    raise exception 'oversized source passed guarded source creation';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe-export',
      '[{"row_number":1,"transaction_id":"unregistered","import_row_token":"20202020-2020-4020-8020-20202020ef01","customer_email":"source@example.com","transaction_date":"2026-08-24","amount_collected":"1","transaction_type":"collection"}]'::jsonb
    );
    raise exception 'unregistered source label bypassed canonical source registry';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      jsonb_build_array(jsonb_build_object(
        'row_number', 10,
        'transaction_id', repeat('x', 513),
        'import_row_token', '20202020-2020-4020-8020-20202020ef02',
        'customer_email', 'id-boundary@example.com',
        'transaction_date', '2026-08-24',
        'amount_collected', '1',
        'transaction_type', 'collection'
      ))
    );
    raise exception 'oversized transaction ID passed guarded RPC validation';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      jsonb_build_array(jsonb_build_object(
        'row_number', 11,
        'transaction_id', 'email-boundary',
        'import_row_token', '20202020-2020-4020-8020-20202020ef03',
        'customer_email', repeat('a', 310) || '@' || repeat('b', 10),
        'transaction_date', '2026-08-24',
        'amount_collected', '1',
        'transaction_type', 'collection'
      ))
    );
    raise exception 'oversized email passed guarded RPC validation';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"transaction_id":"missing-row-number","import_row_token":"20202020-2020-4020-8020-20202020ef04","customer_email":"row@example.com","transaction_date":"2026-08-24","amount_collected":"1","transaction_type":"collection"}]'::jsonb
    );
    raise exception 'missing row number passed guarded RPC validation';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"row_number":12,"transaction_id":"missing-token","customer_email":"token@example.com","transaction_date":"2026-08-24","amount_collected":"1","transaction_type":"collection"}]'::jsonb
    );
    raise exception 'missing import row token passed guarded RPC validation';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"row_number":13,"transaction_id":"missing-type","import_row_token":"20202020-2020-4020-8020-20202020ef05","customer_email":"type-boundary@example.com","transaction_date":"2026-08-24","amount_collected":"1"}]'::jsonb
    );
    raise exception 'missing transaction type passed guarded RPC validation';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

do $$
begin
  begin
    insert into public.customer_transaction_sources (
      business_id, source, created_by_user_id
    ) values (
      '20202020-2020-4020-8020-20202020a001', 'bypass-source', '20202020-2020-4020-8020-202020202001'
    );
    raise exception 'authenticated owner bypassed guarded source creation RPC';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.customer_transactions (
      business_id, source, import_row_token, customer_email, transaction_date,
      amount_collected, transaction_type, source_row_number, imported_by_user_id
    ) values (
      '20202020-2020-4020-8020-20202020a001', 'stripe', '20202020-2020-4020-8020-20202020ef06',
      'bypass@example.com', '2026-08-24', 10, 'collection', 99, '20202020-2020-4020-8020-202020202001'
    );
    raise exception 'authenticated owner bypassed guarded import RPC with direct insert';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.customer_transaction_duplicate_resolutions (
      resolution_token, import_row_token, business_id, source, customer_email, transaction_date,
      amount_collected, transaction_type, source_row_number, decision, candidate_match_count, resolved_by_user_id
    ) values (
      '20202020-2020-4020-8020-20202020d099', '20202020-2020-4020-8020-20202020ef07',
      '20202020-2020-4020-8020-20202020a001', 'stripe', 'bypass@example.com', '2026-08-24', 10,
      'collection', 99, 'duplicate', 1, '20202020-2020-4020-8020-202020202001'
    );
    raise exception 'authenticated owner bypassed guarded import RPC with direct resolution insert';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local request.jwt.claims =
  '{"sub":"20202020-2020-4020-8020-202020202002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_transaction_sources
    where business_id = '20202020-2020-4020-8020-20202020a001'
  ) then
    raise exception 'owner B read owner A transaction sources';
  end if;

  if exists (
    select 1 from public.customer_transactions
    where business_id = '20202020-2020-4020-8020-20202020a001'
  ) then
    raise exception 'owner B read owner A customer transactions';
  end if;

  if exists (
    select 1 from public.customer_transaction_duplicate_resolutions
    where business_id = '20202020-2020-4020-8020-20202020a001'
  ) then
    raise exception 'owner B read owner A duplicate-resolution audit';
  end if;

  begin
    perform public.create_customer_transaction_source(
      '20202020-2020-4020-8020-20202020a001', 'blocked-source'
    );
    raise exception 'owner B created a source for owner A business';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"row_number":1,"transaction_id":"blocked","import_row_token":"20202020-2020-4020-8020-20202020ef08","customer_email":"blocked@example.com","transaction_date":"2026-08-24","amount_collected":"1","transaction_type":"collection"}]'::jsonb
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
  if (select count(*) from public.customer_transaction_sources
      where business_id = '20202020-2020-4020-8020-20202020a001') <> 2 then
    raise exception 'read-only business member could not read permitted transaction sources';
  end if;

  if (select count(*) from public.customer_transactions
      where business_id = '20202020-2020-4020-8020-20202020a001') <> 9 then
    raise exception 'read-only business member could not read permitted transaction history';
  end if;

  if (select count(*) from public.customer_transaction_duplicate_resolutions
      where business_id = '20202020-2020-4020-8020-20202020a001') <> 4 then
    raise exception 'read-only business member could not read permitted duplicate-resolution audit';
  end if;

  begin
    perform public.create_customer_transaction_source(
      '20202020-2020-4020-8020-20202020a001', 'member-source'
    );
    raise exception 'read-only business member created a transaction source';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.import_customer_transactions(
      '20202020-2020-4020-8020-20202020a001',
      'stripe',
      '[{"row_number":1,"transaction_id":"member-blocked","import_row_token":"20202020-2020-4020-8020-20202020ef09","customer_email":"member@example.com","transaction_date":"2026-08-24","amount_collected":"1","transaction_type":"collection"}]'::jsonb
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
  perform public.create_customer_transaction_source(
    '20202020-2020-4020-8020-20202020b002',
    'Stripe'
  );

  admin_result := public.import_customer_transactions(
    '20202020-2020-4020-8020-20202020b002',
    'stripe',
    '[{"row_number":1,"transaction_id":"admin-txn","import_row_token":"20202020-2020-4020-8020-20202020ef10","customer_email":"admin@example.com","transaction_date":"2026-08-24","amount_collected":"50","transaction_type":"collection"}]'::jsonb
  );

  if (admin_result ->> 'inserted_count')::integer <> 1 then
    raise exception 'admin could not import into managed business: %', admin_result;
  end if;

  if (select count(*) from public.customer_transaction_sources) <> 3 then
    raise exception 'admin could not read all protected transaction sources';
  end if;

  if (select count(*) from public.customer_transactions) <> 10 then
    raise exception 'admin could not read all protected transactions';
  end if;

  if (select count(*) from public.customer_transaction_duplicate_resolutions) <> 4 then
    raise exception 'admin could not read duplicate-resolution audit';
  end if;
end $$;

rollback;

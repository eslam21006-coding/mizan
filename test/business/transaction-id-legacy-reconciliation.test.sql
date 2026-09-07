begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '63636363-6363-4636-8636-636363636301',
  'transaction-id-reconcile-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  '63636363-6363-4636-8636-636363636302',
  'Transaction ID Reconciliation',
  'EGP',
  'Africa/Cairo',
  '63636363-6363-4636-8636-636363636301',
  '63636363-6363-4636-8636-636363636303'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"63636363-6363-4636-8636-636363636301","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  legacy_result jsonb;
  reconciliation_result jsonb;
  definitive_retry_result jsonb;
  repeat_purchase_result jsonb;
  transaction_count integer;
  total_cash numeric;
begin
  perform public.create_customer_transaction_source(
    '63636363-6363-4636-8636-636363636302',
    'gateway'
  );

  legacy_result := public.import_customer_transactions(
    '63636363-6363-4636-8636-636363636302',
    'gateway',
    '[{
      "row_number":10,
      "transaction_id":null,
      "import_row_token":"63636363-6363-4636-8636-636363636310",
      "customer_email":"repeat@example.com",
      "transaction_date":"2026-08-28T14:34:00Z",
      "amount_collected":"1500",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (legacy_result ->> 'inserted_count')::integer <> 1 then
    raise exception 'legacy no-ID setup row was not inserted: %', legacy_result;
  end if;

  reconciliation_result := public.import_customer_transactions(
    '63636363-6363-4636-8636-636363636302',
    'gateway',
    '[{
      "row_number":10,
      "transaction_id":"gateway-txn-001",
      "import_row_token":"63636363-6363-4636-8636-636363636311",
      "customer_email":"repeat@example.com",
      "transaction_date":"2026-08-28T14:34:00Z",
      "amount_collected":"1500.00",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (reconciliation_result ->> 'inserted_count')::integer <> 0
    or (reconciliation_result ->> 'duplicate_count')::integer <> 1
    or (reconciliation_result ->> 'candidate_count')::integer <> 0 then
    raise exception 'legacy row was not reconciled as an automatic definitive duplicate: %', reconciliation_result;
  end if;

  if (select source_transaction_id
      from public.customer_transactions
      where business_id = '63636363-6363-4636-8636-636363636302'
        and import_row_token = '63636363-6363-4636-8636-636363636310') <> 'gateway-txn-001' then
    raise exception 'gateway Transaction ID was not attached to the exact legacy row';
  end if;

  select count(*), coalesce(sum(amount_collected), 0)
  into transaction_count, total_cash
  from public.customer_transactions
  where business_id = '63636363-6363-4636-8636-636363636302';

  if transaction_count <> 1 or total_cash <> 1500 then
    raise exception 'ID reconciliation changed transaction count or cash: count %, cash %', transaction_count, total_cash;
  end if;

  definitive_retry_result := public.import_customer_transactions(
    '63636363-6363-4636-8636-636363636302',
    'gateway',
    '[{
      "row_number":10,
      "transaction_id":"gateway-txn-001",
      "import_row_token":"63636363-6363-4636-8636-636363636312",
      "customer_email":"repeat@example.com",
      "transaction_date":"2026-08-28T14:34:00Z",
      "amount_collected":"1500",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (definitive_retry_result ->> 'duplicate_count')::integer <> 1 then
    raise exception 'reconciled Transaction ID did not become a definitive duplicate key: %', definitive_retry_result;
  end if;

  repeat_purchase_result := public.import_customer_transactions(
    '63636363-6363-4636-8636-636363636302',
    'gateway',
    '[{
      "row_number":11,
      "transaction_id":"gateway-txn-002",
      "import_row_token":"63636363-6363-4636-8636-636363636313",
      "customer_email":"repeat@example.com",
      "transaction_date":"2026-08-28T14:34:00Z",
      "amount_collected":"1500",
      "transaction_type":"collection",
      "normalized_outcome":"successful",
      "currency":"EGP"
    }]'::jsonb
  );

  if (repeat_purchase_result ->> 'inserted_count')::integer <> 1
    or (repeat_purchase_result ->> 'candidate_count')::integer <> 0 then
    raise exception 'different Transaction ID/source row was not preserved as a legitimate repeat purchase: %', repeat_purchase_result;
  end if;

  select count(*), coalesce(sum(amount_collected), 0)
  into transaction_count, total_cash
  from public.customer_transactions
  where business_id = '63636363-6363-4636-8636-636363636302';

  if transaction_count <> 2 or total_cash <> 3000 then
    raise exception 'legitimate repeat purchase was not counted exactly once: count %, cash %', transaction_count, total_cash;
  end if;

  if has_function_privilege(
    'authenticated',
    'private.reconcile_legacy_customer_transaction_id()',
    'EXECUTE'
  ) then
    raise exception 'authenticated unexpectedly has direct execute privilege on the private reconciliation trigger function';
  end if;
end;
$$;

rollback;

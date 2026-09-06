begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('62626262-6262-4626-8626-626262626261', 'mapping-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('62626262-6262-4626-8626-626262626262', 'mapping-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('62626262-6262-4626-8626-626262626263', 'mapping-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '62626262-aaaa-4626-8626-626262626261',
  'Mapping Memory Test',
  'USD',
  'Africa/Cairo',
  '62626262-6262-4626-8626-626262626261',
  '62626262-bbbb-4626-8626-626262626261'
);

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  '62626262-aaaa-4626-8626-626262626261',
  '62626262-6262-4626-8626-626262626262',
  'member'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"62626262-6262-4626-8626-626262626261","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.customer_transaction_column_mappings (
  business_id,
  header_fingerprint,
  header_columns,
  mapping
)
values (
  '62626262-aaaa-4626-8626-626262626261',
  repeat('a', 64),
  '["internal transaction id","customer email","currency","total amount paid","status","transaction date"]'::jsonb,
  '{"customerEmail":1,"transactionDate":5,"amountCollected":3,"transactionId":0,"currency":2}'::jsonb
);

DO $$
begin
  if (select count(*) from public.customer_transaction_column_mappings) <> 1 then
    raise exception 'business owner could not read saved transaction column mapping';
  end if;

  if exists (
    select 1
    from public.customer_transaction_column_mappings
    where created_by_user_id <> '62626262-6262-4626-8626-626262626261'
  ) then
    raise exception 'mapping creator was not bound to auth.uid()';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62626262-6262-4626-8626-626262626262","role":"authenticated","app_metadata":{"role":"mentee"}}';

DO $$
begin
  if (select count(*) from public.customer_transaction_column_mappings) <> 0 then
    raise exception 'read-only business member could read owner-only mapping memory';
  end if;

  begin
    insert into public.customer_transaction_column_mappings (
      business_id,
      header_fingerprint,
      header_columns,
      mapping
    )
    values (
      '62626262-aaaa-4626-8626-626262626261',
      repeat('b', 64),
      '["email","date","amount"]'::jsonb,
      '{"customerEmail":0,"transactionDate":1,"amountCollected":2}'::jsonb
    );
    raise exception 'read-only member unexpectedly inserted mapping memory';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62626262-6262-4626-8626-626262626263","role":"authenticated","app_metadata":{"role":"admin"}}';

DO $$
begin
  if (select count(*) from public.customer_transaction_column_mappings) <> 1 then
    raise exception 'admin could not read mapping memory';
  end if;
end $$;

update public.customer_transaction_column_mappings
set mapping = '{"customerEmail":1,"transactionDate":5,"amountCollected":3,"transactionId":0,"currency":null}'::jsonb
where business_id = '62626262-aaaa-4626-8626-626262626261'
  and header_fingerprint = repeat('a', 64);

DO $$
begin
  if not exists (
    select 1
    from public.customer_transaction_column_mappings
    where business_id = '62626262-aaaa-4626-8626-626262626261'
      and mapping -> 'currency' = 'null'::jsonb
  ) then
    raise exception 'admin could not update mapping memory created by owner';
  end if;
end $$;

rollback;

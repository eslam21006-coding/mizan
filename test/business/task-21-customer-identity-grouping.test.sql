begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('21212121-2121-4121-8121-212121212001', 'task21-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('21212121-2121-4121-8121-212121212002', 'task21-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('21212121-2121-4121-8121-212121212003', 'task21-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('21212121-2121-4121-8121-212121212004', 'task21-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('21212121-2121-4121-8121-21212121a001', 'Task 21 Business A', 'EGP', 'Africa/Cairo', '21212121-2121-4121-8121-212121212001', '21212121-2121-4121-8121-21212121c001'),
  ('21212121-2121-4121-8121-21212121b002', 'Task 21 Business B', 'SAR', 'Asia/Riyadh', '21212121-2121-4121-8121-212121212002', '21212121-2121-4121-8121-21212121c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('21212121-2121-4121-8121-21212121a001', '21212121-2121-4121-8121-212121212003', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"21212121-2121-4121-8121-212121212001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source(
  '21212121-2121-4121-8121-21212121a001',
  'stripe'
);

select public.import_customer_transactions(
  '21212121-2121-4121-8121-21212121a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"later-collection","import_row_token":"21212121-2121-4121-8121-21212121e001","customer_email":" Buyer@Example.COM ","transaction_date":"2026-01-05T12:00:00Z","amount_collected":"50","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":2,"transaction_id":"pre-acquisition-refund","import_row_token":"21212121-2121-4121-8121-21212121e002","customer_email":"buyer@example.com","transaction_date":"2026-01-01T09:00:00Z","amount_collected":"20","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":3,"transaction_id":"earliest-collection","import_row_token":"21212121-2121-4121-8121-21212121e003","customer_email":"BUYER@example.com","transaction_date":"2026-01-02T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":4,"transaction_id":"later-refund","import_row_token":"21212121-2121-4121-8121-21212121e004","customer_email":"buyer@example.com","transaction_date":"2026-01-06T10:00:00Z","amount_collected":"10","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"},
    {"row_number":5,"transaction_id":"refund-only","import_row_token":"21212121-2121-4121-8121-21212121e005","customer_email":"refund-only@example.com","transaction_date":"2026-01-03T10:00:00Z","amount_collected":"5","transaction_type":"refund","normalized_outcome":"successful","currency":"EGP"}
  ]'::jsonb
);

do $$
declare
  buyer public.customer_transaction_groups%rowtype;
  refund_only public.customer_transaction_groups%rowtype;
begin
  select * into buyer
  from public.customer_transaction_groups
  where business_id = '21212121-2121-4121-8121-21212121a001'
    and customer_email = 'buyer@example.com';

  if not found then
    raise exception 'normalized buyer identity was not grouped';
  end if;

  if buyer.acquisition_at <> '2026-01-02 10:00:00+00'::timestamptz
    or buyer.acquisition_date <> '2026-01-02'::date then
    raise exception 'acquisition was not the earliest successful positive collection: %, %', buyer.acquisition_at, buyer.acquisition_date;
  end if;

  if buyer.transaction_count <> 4
    or buyer.collection_count <> 2
    or buyer.refund_count <> 2 then
    raise exception 'transaction grouping counts are wrong: %, %, %', buyer.transaction_count, buyer.collection_count, buyer.refund_count;
  end if;

  if buyer.gross_cash_collected <> 150
    or buyer.refunds <> 30
    or buyer.net_cash_collected <> 120 then
    raise exception 'grouped cash totals are wrong: gross %, refunds %, net %', buyer.gross_cash_collected, buyer.refunds, buyer.net_cash_collected;
  end if;

  if buyer.gross_cash_collected_text <> '150'
    or buyer.refunds_text <> '30'
    or buyer.net_cash_collected_text <> '120' then
    raise exception 'exact financial transport text is wrong: gross %, refunds %, net %', buyer.gross_cash_collected_text, buyer.refunds_text, buyer.net_cash_collected_text;
  end if;

  if buyer.currency <> 'EGP' then
    raise exception 'group currency did not preserve the business base currency: %', buyer.currency;
  end if;

  select * into refund_only
  from public.customer_transaction_groups
  where business_id = '21212121-2121-4121-8121-21212121a001'
    and customer_email = 'refund-only@example.com';

  if not found then
    raise exception 'refund-only identity disappeared from grouping';
  end if;

  if refund_only.acquisition_at is not null or refund_only.acquisition_date is not null then
    raise exception 'refund-only identity incorrectly established acquisition';
  end if;

  if refund_only.gross_cash_collected <> 0
    or refund_only.refunds <> 5
    or refund_only.net_cash_collected <> -5 then
    raise exception 'refund-only financial totals are wrong';
  end if;

  if refund_only.gross_cash_collected_text <> '0'
    or refund_only.refunds_text <> '5'
    or refund_only.net_cash_collected_text <> '-5' then
    raise exception 'refund-only exact financial transport text is wrong';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"21212121-2121-4121-8121-212121212002","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source(
  '21212121-2121-4121-8121-21212121b002',
  'stripe'
);

select public.import_customer_transactions(
  '21212121-2121-4121-8121-21212121b002',
  'stripe',
  '[{"row_number":1,"transaction_id":"business-b-collection","import_row_token":"21212121-2121-4121-8121-21212121e101","customer_email":"buyer@example.com","transaction_date":"2026-01-01T10:00:00Z","amount_collected":"999","transaction_type":"collection","normalized_outcome":"successful","currency":"SAR"}]'::jsonb
);

do $$
begin
  if (select count(*) from public.customer_transaction_groups
      where business_id = '21212121-2121-4121-8121-21212121a001') <> 0 then
    raise exception 'owner B can read customer groups from business A';
  end if;

  if (select count(*) from public.customer_transaction_groups
      where business_id = '21212121-2121-4121-8121-21212121b002'
        and customer_email = 'buyer@example.com') <> 1 then
    raise exception 'same normalized email was not independently grouped inside business B';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"21212121-2121-4121-8121-212121212003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.customer_transaction_groups
      where business_id = '21212121-2121-4121-8121-21212121a001') <> 2 then
    raise exception 'authorized business member cannot read business A customer groups';
  end if;

  if (select count(*) from public.customer_transaction_groups
      where business_id = '21212121-2121-4121-8121-21212121b002') <> 0 then
    raise exception 'business A member can read business B customer groups';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"21212121-2121-4121-8121-212121212004","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if (select count(*) from public.customer_transaction_groups
      where customer_email = 'buyer@example.com') <> 2 then
    raise exception 'admin cannot read both business-scoped buyer identities';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform count(*) from public.customer_transaction_groups;
    raise exception 'anonymous user unexpectedly read customer transaction groups';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

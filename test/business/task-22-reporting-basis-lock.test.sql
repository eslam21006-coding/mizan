begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values ('22222222-2222-4222-8222-222222229001', 'task22-basis-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  ('22222222-2222-4222-8222-22222222d001', 'Task 22 Basis History', 'EGP', 'Africa/Cairo', '22222222-2222-4222-8222-222222229001', '22222222-2222-4222-8222-22222222f001'),
  ('22222222-2222-4222-8222-22222222d002', 'Task 22 Basis Empty', 'EGP', 'Africa/Cairo', '22222222-2222-4222-8222-222222229001', '22222222-2222-4222-8222-22222222f002');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222229001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source(
  '22222222-2222-4222-8222-22222222d001',
  'stripe'
);

select public.import_customer_transactions(
  '22222222-2222-4222-8222-22222222d001',
  'stripe',
  '[{"row_number":1,"transaction_id":"basis-1","import_row_token":"22222222-2222-4222-8222-22222222e901","customer_email":"basis@example.com","transaction_date":"2026-01-01T10:00:00Z","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"}]'::jsonb
);

do $$
begin
  begin
    update public.businesses
    set base_currency = 'USD'
    where id = '22222222-2222-4222-8222-22222222d001';
    raise exception 'base currency changed after transaction history existed';
  exception
    when check_violation then null;
  end;

  begin
    update public.businesses
    set timezone = 'UTC'
    where id = '22222222-2222-4222-8222-22222222d001';
    raise exception 'reporting timezone changed after transaction history existed';
  exception
    when check_violation then null;
  end;

  update public.businesses
  set name = 'Task 22 Basis History Renamed'
  where id = '22222222-2222-4222-8222-22222222d001';

  update public.businesses
  set base_currency = 'USD', timezone = 'UTC'
  where id = '22222222-2222-4222-8222-22222222d002';

  if not exists (
    select 1
    from public.businesses
    where id = '22222222-2222-4222-8222-22222222d001'
      and name = 'Task 22 Basis History Renamed'
      and base_currency = 'EGP'
      and timezone = 'Africa/Cairo'
  ) then
    raise exception 'non-basis update failed or protected reporting basis changed';
  end if;

  if not exists (
    select 1
    from public.businesses
    where id = '22222222-2222-4222-8222-22222222d002'
      and base_currency = 'USD'
      and timezone = 'UTC'
  ) then
    raise exception 'empty business reporting basis should remain editable';
  end if;
end;
$$;

reset role;

do $$
begin
  begin
    insert into public.customer_transactions (
      id, business_id, source, source_transaction_id, import_row_token, customer_email,
      transaction_date, source_transaction_at, transaction_at, amount_collected,
      transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
    ) values (
      '22222222-2222-4222-8222-22222222e902',
      '22222222-2222-4222-8222-22222222d001',
      'stripe', 'basis-wrong-currency', '22222222-2222-4222-8222-22222222e903',
      'wrong-currency@example.com', '2026-01-02', '2026-01-02T10:00:00Z',
      '2026-01-02T10:00:00Z'::timestamptz, 10, 'collection', 'successful', 'USD', 2,
      '22222222-2222-4222-8222-222222229001'
    );
    raise exception 'direct transaction write bypassed business currency invariant';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.customer_transactions (
      id, business_id, source, source_transaction_id, import_row_token, customer_email,
      transaction_date, source_transaction_at, transaction_at, amount_collected,
      transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
    ) values (
      '22222222-2222-4222-8222-22222222e904',
      '22222222-2222-4222-8222-22222222d001',
      'stripe', 'basis-wrong-date', '22222222-2222-4222-8222-22222222e905',
      'wrong-date@example.com', '2026-01-03', '2026-01-02T10:00:00Z',
      '2026-01-02T10:00:00Z'::timestamptz, 10, 'collection', 'successful', 'EGP', 3,
      '22222222-2222-4222-8222-222222229001'
    );
    raise exception 'direct transaction write bypassed business timezone/date invariant';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;

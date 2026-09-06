begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('75757575-7575-4757-8757-757575757575', 'history-delete-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('76767676-7676-4767-8767-767676767676', 'history-delete-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '75757575-aaaa-4757-8757-757575757575',
  'History Confirmer Delete Business',
  'USD',
  'Africa/Cairo',
  '75757575-7575-4757-8757-757575757575',
  '75757575-bbbb-4757-8757-757575757575'
);

insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
values (
  '75757575-aaaa-4757-8757-757575757575',
  'stripe',
  '75757575-7575-4757-8757-757575757575'
);

insert into public.customer_transactions (
  id, business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, source_transaction_at, transaction_at, amount_collected,
  transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
) values (
  '75000000-0000-4000-8000-000000000001',
  '75757575-aaaa-4757-8757-757575757575',
  'stripe',
  'history-delete-qualifying-purchase',
  '75000000-0000-4000-8000-000000000002',
  'buyer@example.test',
  '2026-08-01',
  '2026-08-01T12:00:00+03:00',
  '2026-08-01T09:00:00Z',
  100,
  'collection',
  'successful',
  'USD',
  1,
  '75757575-7575-4757-8757-757575757575'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"76767676-7676-4767-8767-767676767676","role":"authenticated","app_metadata":{"role":"admin"}}';

select public.set_transaction_history_complete(
  '75757575-aaaa-4757-8757-757575757575',
  true
);

reset role;

delete from auth.users
where id = '76767676-7676-4767-8767-767676767676';

do $$
begin
  if not exists (
    select 1
    from public.business_transaction_history_status
    where business_id = '75757575-aaaa-4757-8757-757575757575'
      and is_complete = true
      and confirmed_at is not null
      and confirmed_by_user_id is null
  ) then
    raise exception 'deleting the confirmer must retain complete history and its confirmation timestamp while clearing only the user reference';
  end if;
end $$;

rollback;

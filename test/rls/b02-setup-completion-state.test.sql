begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('b0211111-1111-4111-8111-111111111111', 'b02-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('b0222222-2222-4222-8222-222222222222', 'b02-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('b0233333-3333-4333-8333-333333333333', 'b02-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('b0244444-4444-4444-8444-444444444444', 'b02-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'b02aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'B02 Business A',
    'EGP',
    'Africa/Cairo',
    'b0211111-1111-4111-8111-111111111111',
    'b0255555-5555-4555-8555-555555555555'
  ),
  (
    'b02bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'B02 Business B',
    'SAR',
    'Asia/Riyadh',
    'b0222222-2222-4222-8222-222222222222',
    'b0266666-6666-4666-8666-666666666666'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'b02aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'b0233333-3333-4333-8333-333333333333',
  'member'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0211111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"mentee"}}';

update public.businesses
set expense_setup_reviewed_at = '2026-09-28T07:45:00Z'
where id = 'b02aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
declare
  affected integer;
begin
  if not exists (
    select 1
    from public.businesses
    where id = 'b02aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and expense_setup_reviewed_at = '2026-09-28T07:45:00Z'::timestamptz
  ) then
    raise exception 'owner could not confirm own expense setup';
  end if;

  update public.businesses
  set expense_setup_reviewed_at = '2026-09-28T08:00:00Z'
  where id = 'b02bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'owner updated another business expense review state';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0233333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if not exists (
    select 1
    from public.businesses
    where id = 'b02aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and expense_setup_reviewed_at is not null
  ) then
    raise exception 'read-only member could not read business setup state';
  end if;

  update public.businesses
  set expense_setup_reviewed_at = '2026-09-28T08:05:00Z'
  where id = 'b02aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'read-only member updated expense setup review state';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b0244444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"role":"admin"}}';

update public.businesses
set expense_setup_reviewed_at = '2026-09-28T08:10:00Z'
where id = 'b02bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

do $$
begin
  if not exists (
    select 1
    from public.businesses
    where id = 'b02bbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and expense_setup_reviewed_at = '2026-09-28T08:10:00Z'::timestamptz
  ) then
    raise exception 'admin could not update expense setup review state';
  end if;
end $$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.businesses', 'UPDATE') then
    raise exception 'anon unexpectedly has UPDATE privilege on businesses';
  end if;
end $$;

rollback;

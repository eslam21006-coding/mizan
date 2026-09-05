begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('a7000000-0000-4000-8000-000000000001', 'business-delete-admin@example.test', '{"role":"admin"}'::jsonb, now(), now()),
  ('a7000000-0000-4000-8000-000000000002', 'business-delete-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('a7000000-0000-4000-8000-000000000003', 'business-delete-member@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  (
    'b7000000-0000-4000-8000-000000000001',
    'Owner deletable business',
    'USD',
    'Africa/Cairo',
    'a7000000-0000-4000-8000-000000000002',
    'c7000000-0000-4000-8000-000000000001'
  ),
  (
    'b7000000-0000-4000-8000-000000000002',
    'Member target business',
    'USD',
    'Africa/Cairo',
    'a7000000-0000-4000-8000-000000000002',
    'c7000000-0000-4000-8000-000000000002'
  ),
  (
    'b7000000-0000-4000-8000-000000000003',
    'Protected monthly business',
    'USD',
    'Africa/Cairo',
    'a7000000-0000-4000-8000-000000000002',
    'c7000000-0000-4000-8000-000000000003'
  ),
  (
    'b7000000-0000-4000-8000-000000000004',
    'Admin deletable business',
    'USD',
    'Africa/Cairo',
    'a7000000-0000-4000-8000-000000000002',
    'c7000000-0000-4000-8000-000000000004'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'b7000000-0000-4000-8000-000000000002',
  'a7000000-0000-4000-8000-000000000003',
  'member'
);

insert into public.monthly_periods (id, business_id, month_start)
values (
  'd7000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000003',
  '2026-08-01'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a7000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  changed_count integer;
begin
  delete from public.businesses
  where id = 'b7000000-0000-4000-8000-000000000001';
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'owner could not delete own deletable business';
  end if;

  begin
    delete from public.businesses
    where id = 'b7000000-0000-4000-8000-000000000003';
    raise exception 'monthly history was deleted with the business';
  exception
    when foreign_key_violation then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a7000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  changed_count integer;
begin
  delete from public.businesses
  where id = 'b7000000-0000-4000-8000-000000000002';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'read-only member deleted a business';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
declare
  changed_count integer;
begin
  delete from public.businesses
  where id = 'b7000000-0000-4000-8000-000000000004';
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'fresh admin could not delete a deletable business';
  end if;
end $$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.businesses
    where id = 'b7000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'protected business disappeared after blocked deletion';
  end if;

  if not exists (
    select 1 from public.monthly_periods
    where business_id = 'b7000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'protected monthly history disappeared after blocked deletion';
  end if;
end $$;

rollback;

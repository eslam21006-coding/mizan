begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('35000000-0000-4000-8000-000000000001', 'task35-admin@example.test', '{"role":"admin"}'::jsonb, '2026-08-01T00:00:00Z', now()),
  ('35000000-0000-4000-8000-000000000002', 'task35-one@example.test', '{"role":"mentee"}'::jsonb, '2026-08-02T00:00:00Z', now()),
  ('35000000-0000-4000-8000-000000000003', 'task35-zero@example.test', '{"role":"mentee"}'::jsonb, '2026-08-03T00:00:00Z', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}';

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('35100000-0000-4000-8000-000000000001', 'Task 35 Alpha', 'EGP', 'Africa/Cairo', '35000000-0000-4000-8000-000000000002', '35200000-0000-4000-8000-000000000001'),
  ('35100000-0000-4000-8000-000000000002', 'Task 35 Beta', 'SAR', 'Asia/Riyadh', '35000000-0000-4000-8000-000000000002', '35200000-0000-4000-8000-000000000002');

do $$
declare
  fixture_directory_count integer;
  zero_business_count integer;
  alpha_count integer;
begin
  select count(*) into fixture_directory_count
  from public.admin_mentee_directory()
  where mentee_user_id in (
    '35000000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000003'
  );
  if fixture_directory_count <> 3 then
    raise exception 'Task 35 fixture mentees expected 3 directory rows, got %', fixture_directory_count;
  end if;

  select count(*) into zero_business_count
  from public.admin_mentee_directory()
  where mentee_user_id = '35000000-0000-4000-8000-000000000003'
    and business_id is null;
  if zero_business_count <> 1 then
    raise exception 'mentee without a business was omitted from the admin directory';
  end if;

  select count(*) into alpha_count
  from public.admin_mentee_directory()
  where mentee_user_id = '35000000-0000-4000-8000-000000000002'
    and business_id in (
      '35100000-0000-4000-8000-000000000001',
      '35100000-0000-4000-8000-000000000002'
    );
  if alpha_count <> 2 then
    raise exception 'admin directory did not expose all owned mentee businesses';
  end if;

  if exists (
    select 1 from public.admin_mentee_directory()
    where mentee_user_id = '35000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'admin account leaked into mentee directory';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  begin
    perform * from public.admin_mentee_directory();
    raise exception 'mentee accessed the admin mentee directory with a stale JWT admin claim';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.admin_mentee_directory()', 'EXECUTE') then
    raise exception 'anon unexpectedly has execute privilege on admin mentee directory';
  end if;

  if not has_function_privilege('authenticated', 'public.admin_mentee_directory()', 'EXECUTE') then
    raise exception 'authenticated role is missing execute privilege required for the guarded RPC';
  end if;
end $$;

rollback;

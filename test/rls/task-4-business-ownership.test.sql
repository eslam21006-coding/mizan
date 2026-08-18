begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task4-admin@example.test', '{"role":"admin"}'::jsonb, now(), now()),
  ('11111111-1111-4111-8111-111111111111', 'task4-mentee1@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'task4-mentee2@example.test', '{"role":"mentee"}'::jsonb, now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.businesses (id, name, base_currency, owner_user_id)
values ('b1111111-1111-4111-8111-111111111111', 'Business One', 'EGP', '11111111-1111-4111-8111-111111111111');

do $$
begin
  if (select count(*) from public.business_memberships where user_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'owner membership was not created';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.businesses (id, name, base_currency, owner_user_id)
values ('b2222222-2222-4222-8222-222222222222', 'Business Two', 'SAR', '22222222-2222-4222-8222-222222222222');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  visible_count integer;
  changed_count integer;
begin
  select count(*) into visible_count from public.businesses;
  if visible_count <> 1 then
    raise exception 'mentee cross-business isolation failed: saw % businesses', visible_count;
  end if;

  if (select count(*) from public.business_memberships) <> 1 then
    raise exception 'mentee could see another user membership';
  end if;

  update public.businesses set name = 'Should Not Change'
  where id = 'b2222222-2222-4222-8222-222222222222';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'mentee updated another business';
  end if;

  begin
    insert into public.business_memberships (business_id, user_id, membership_role)
    values ('b2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'owner');
    raise exception 'mentee self-added to another business';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.businesses
    set owner_user_id = '22222222-2222-4222-8222-222222222222'
    where id = 'b1111111-1111-4111-8111-111111111111';
    raise exception 'mentee transferred ownership';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not (select private.is_admin()) then
    raise exception 'fresh admin lookup failed';
  end if;
  if (select count(*) from public.businesses) <> 2 then
    raise exception 'admin cannot see all businesses';
  end if;
  if (select count(*) from public.business_memberships) <> 2 then
    raise exception 'admin cannot see all memberships';
  end if;
end $$;

insert into public.business_memberships (business_id, user_id, membership_role)
values ('b2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'member');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
declare
  changed_count integer;
begin
  if (select private.is_admin()) then
    raise exception 'stale JWT admin claim incorrectly granted admin';
  end if;

  if (select count(*) from public.businesses) <> 2 then
    raise exception 'explicit membership did not grant read access';
  end if;

  if (select count(*) from public.business_memberships) <> 2 then
    raise exception 'mentee membership visibility is incorrect';
  end if;

  update public.businesses set name = 'Member Cannot Edit'
  where id = 'b2222222-2222-4222-8222-222222222222';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'read-only member updated non-owned business';
  end if;
end $$;

reset role;

rollback;

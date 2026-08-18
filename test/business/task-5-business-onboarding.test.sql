begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('55555555-5555-4555-8555-555555555555', 'task5-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('66666666-6666-4666-8666-666666666666', 'task5-other@example.test', '{"role":"mentee"}'::jsonb, now(), now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_timezone_shape_check'
      and conrelid = 'public.businesses'::regclass
      and convalidated
  ) then
    raise exception 'timezone constraint is not validated';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_owner_creation_request_unique'
      and conrelid = 'public.businesses'::regclass
      and contype = 'u'
  ) then
    raise exception 'business creation idempotency constraint is missing';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    insert into public.businesses (name, base_currency, timezone, owner_user_id)
    values (
      'Missing Request ID',
      'EGP',
      'Africa/Cairo',
      '55555555-5555-4555-8555-555555555555'
    );
    raise exception 'business creation without an explicit request id succeeded';
  exception
    when not_null_violation then null;
  end;
end $$;

insert into public.businesses (
  id,
  name,
  base_currency,
  timezone,
  owner_user_id,
  creation_request_id
)
values (
  'b5555555-5555-4555-8555-555555555555',
  'Task 5 Business',
  'EGP',
  'Africa/Cairo',
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777'
);

do $$
begin
  if (
    select count(*)
    from public.businesses
    where id = 'b5555555-5555-4555-8555-555555555555'
      and base_currency = 'EGP'
      and timezone = 'Africa/Cairo'
      and owner_user_id = '55555555-5555-4555-8555-555555555555'
      and creation_request_id = '77777777-7777-4777-8777-777777777777'
  ) <> 1 then
    raise exception 'business onboarding fields were not persisted';
  end if;

  if (
    select count(*)
    from public.business_memberships
    where business_id = 'b5555555-5555-4555-8555-555555555555'
      and user_id = '55555555-5555-4555-8555-555555555555'
      and membership_role = 'owner'
  ) <> 1 then
    raise exception 'business onboarding did not preserve Task 4 owner membership';
  end if;

  begin
    insert into public.businesses (
      id,
      name,
      base_currency,
      timezone,
      owner_user_id,
      creation_request_id
    )
    values (
      'b7777777-7777-4777-8777-777777777777',
      'Duplicate Delivery',
      'EGP',
      'Africa/Cairo',
      '55555555-5555-4555-8555-555555555555',
      '77777777-7777-4777-8777-777777777777'
    );
    raise exception 'duplicate creation request created a second business';
  exception
    when unique_violation then null;
  end;

  if (
    select count(*)
    from public.businesses
    where owner_user_id = '55555555-5555-4555-8555-555555555555'
      and creation_request_id = '77777777-7777-4777-8777-777777777777'
  ) <> 1 then
    raise exception 'creation request idempotency did not preserve exactly one business';
  end if;

  begin
    update public.businesses
    set creation_request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where id = 'b5555555-5555-4555-8555-555555555555';
    raise exception 'owner changed immutable creation request id';
  exception
    when insufficient_privilege then null;
  end;

  if (
    select creation_request_id
    from public.businesses
    where id = 'b5555555-5555-4555-8555-555555555555'
  ) <> '77777777-7777-4777-8777-777777777777'::uuid then
    raise exception 'creation request id changed despite immutability trigger';
  end if;

  begin
    insert into public.businesses (name, base_currency, timezone, owner_user_id, creation_request_id)
    values (
      'Spoofed Owner',
      'EGP',
      'Africa/Cairo',
      '66666666-6666-4666-8666-666666666666',
      '88888888-8888-4888-8888-888888888888'
    );
    raise exception 'mentee created a business for another owner';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.businesses (name, base_currency, timezone, owner_user_id, creation_request_id)
    values (
      'Malformed Timezone',
      'EGP',
      'not a timezone',
      '55555555-5555-4555-8555-555555555555',
      '99999999-9999-4999-8999-999999999999'
    );
    raise exception 'malformed timezone bypassed database constraint';
  exception
    when check_violation then null;
  end;
end $$;

rollback;

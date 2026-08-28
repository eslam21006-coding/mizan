begin;

-- Task 39 is intentionally global: it audits the final database catalog after every
-- application migration has been applied. Individual feature tests remain the detailed
-- authorization tests; these assertions prevent a future object from silently falling
-- outside those feature-specific matrices.

do $$
declare
  insecure_objects text;
begin
  select string_agg(format('%I.%I', namespace.nspname, relation.relname), ', ' order by relation.relname)
    into insecure_objects
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and not relation.relrowsecurity;

  if insecure_objects is not null then
    raise exception 'Task 39: public application tables without RLS: %', insecure_objects;
  end if;
end $$;

do $$
declare
  exposed_objects text;
begin
  select string_agg(format('%I.%I', namespace.nspname, relation.relname), ', ' order by relation.relname)
    into exposed_objects
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p', 'v', 'm')
    and (
      has_table_privilege('anon', relation.oid, 'SELECT')
      or has_table_privilege('anon', relation.oid, 'INSERT')
      or has_table_privilege('anon', relation.oid, 'UPDATE')
      or has_table_privilege('anon', relation.oid, 'DELETE')
      or has_table_privilege('anon', relation.oid, 'TRUNCATE')
      or has_table_privilege('anon', relation.oid, 'REFERENCES')
      or has_table_privilege('anon', relation.oid, 'TRIGGER')
    );

  if exposed_objects is not null then
    raise exception 'Task 39: anon inherited direct privileges on application relations: %', exposed_objects;
  end if;
end $$;

do $$
declare
  exposed_sequences text;
begin
  select string_agg(format('%I.%I', namespace.nspname, relation.relname), ', ' order by relation.relname)
    into exposed_sequences
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind = 'S'
    and (
      has_sequence_privilege('anon', relation.oid, 'USAGE')
      or has_sequence_privilege('anon', relation.oid, 'SELECT')
      or has_sequence_privilege('anon', relation.oid, 'UPDATE')
    );

  if exposed_sequences is not null then
    raise exception 'Task 39: anon inherited sequence privileges: %', exposed_sequences;
  end if;
end $$;

do $$
declare
  unsafe_views text;
begin
  select string_agg(format('%I.%I', namespace.nspname, relation.relname), ', ' order by relation.relname)
    into unsafe_views
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind = 'v'
    and not (
      coalesce(relation.reloptions, array[]::text[]) @> array['security_invoker=true']::text[]
    );

  if unsafe_views is not null then
    raise exception 'Task 39: public views must use security_invoker=true: %', unsafe_views;
  end if;
end $$;

do $$
declare
  unsafe_functions text;
begin
  select string_agg(procedure.oid::regprocedure::text, ', ' order by procedure.oid::regprocedure::text)
    into unsafe_functions
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and procedure.prosecdef
    and not exists (
      select 1
      from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
      where setting like 'search_path=%'
        and lower(setting) not like '%public%'
        and lower(setting) not like '%$user%'
    );

  if unsafe_functions is not null then
    raise exception 'Task 39: SECURITY DEFINER functions without a pinned safe search_path: %', unsafe_functions;
  end if;
end $$;

do $$
declare
  exposed_functions text;
begin
  select string_agg(procedure.oid::regprocedure::text, ', ' order by procedure.oid::regprocedure::text)
    into exposed_functions
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and has_function_privilege('anon', procedure.oid, 'EXECUTE');

  if exposed_functions is not null then
    raise exception 'Task 39: anon inherited EXECUTE on application functions: %', exposed_functions;
  end if;
end $$;

do $$
begin
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'Task 39: client roles must not have CREATE on public schema';
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE')
     or has_schema_privilege('anon', 'private', 'CREATE')
     or has_schema_privilege('authenticated', 'private', 'CREATE') then
    raise exception 'Task 39: private schema boundary is too permissive';
  end if;

  if has_table_privilege('anon', 'auth.users', 'SELECT')
     or has_table_privilege('authenticated', 'auth.users', 'SELECT')
     or has_table_privilege('anon', 'auth.users', 'INSERT')
     or has_table_privilege('authenticated', 'auth.users', 'INSERT')
     or has_table_privilege('anon', 'auth.users', 'UPDATE')
     or has_table_privilege('authenticated', 'auth.users', 'UPDATE')
     or has_table_privilege('anon', 'auth.users', 'DELETE')
     or has_table_privilege('authenticated', 'auth.users', 'DELETE') then
    raise exception 'Task 39: auth.users must not be directly accessible to client roles';
  end if;
end $$;

-- Consolidated role/tenant smoke test. This deliberately gives the outsider a forged/stale
-- JWT admin claim while keeping their authoritative auth.users app metadata as mentee.
insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('39000000-0000-4000-8000-000000000001', 'task39-admin@example.test', '{"role":"admin"}'::jsonb, now(), now()),
  ('39000000-0000-4000-8000-000000000002', 'task39-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('39000000-0000-4000-8000-000000000003', 'task39-member-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('39000000-0000-4000-8000-000000000004', 'task39-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('39000000-0000-4000-8000-000000000005', 'task39-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}';

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('39100000-0000-4000-8000-000000000001', 'Task 39 Tenant A', 'EGP', 'Africa/Cairo', '39000000-0000-4000-8000-000000000002', '39200000-0000-4000-8000-000000000001'),
  ('39100000-0000-4000-8000-000000000002', 'Task 39 Tenant B', 'USD', 'UTC', '39000000-0000-4000-8000-000000000004', '39200000-0000-4000-8000-000000000002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('39100000-0000-4000-8000-000000000001', '39000000-0000-4000-8000-000000000003', 'member');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not private.can_read_business('39100000-0000-4000-8000-000000000001')
     or not private.can_manage_business('39100000-0000-4000-8000-000000000001') then
    raise exception 'Task 39: business owner lost read/manage access to own tenant';
  end if;
  if private.can_read_business('39100000-0000-4000-8000-000000000002')
     or private.can_manage_business('39100000-0000-4000-8000-000000000002') then
    raise exception 'Task 39: business owner crossed tenant boundary';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not private.can_read_business('39100000-0000-4000-8000-000000000001') then
    raise exception 'Task 39: member lost read access to assigned tenant';
  end if;
  if private.can_manage_business('39100000-0000-4000-8000-000000000001') then
    raise exception 'Task 39: read-only member gained manage permission';
  end if;
  if private.can_read_business('39100000-0000-4000-8000-000000000002') then
    raise exception 'Task 39: member crossed tenant boundary';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  if private.is_admin() then
    raise exception 'Task 39: stale/forged JWT admin claim bypassed authoritative app metadata';
  end if;
  if private.can_read_business('39100000-0000-4000-8000-000000000001')
     or private.can_manage_business('39100000-0000-4000-8000-000000000001')
     or private.can_read_business('39100000-0000-4000-8000-000000000002')
     or private.can_manage_business('39100000-0000-4000-8000-000000000002') then
    raise exception 'Task 39: outsider gained tenant access through forged JWT metadata';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not private.is_admin() then
    raise exception 'Task 39: fresh database admin metadata was not authoritative';
  end if;
  if not private.can_read_business('39100000-0000-4000-8000-000000000001')
     or not private.can_manage_business('39100000-0000-4000-8000-000000000001')
     or not private.can_read_business('39100000-0000-4000-8000-000000000002')
     or not private.can_manage_business('39100000-0000-4000-8000-000000000002') then
    raise exception 'Task 39: authoritative admin cannot access all tenants';
  end if;
end $$;

reset role;
rollback;

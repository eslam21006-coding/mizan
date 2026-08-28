-- Task 39: SECURITY DEFINER routines must not implicitly search attacker-controlled
-- temporary schemas. Keep built-ins available through pg_catalog and place pg_temp last.
do $$
declare
  routine record;
begin
  for routine in
    select
      procedure.prokind,
      namespace.nspname as schema_name,
      procedure.proname as routine_name,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.prosecdef
  loop
    if routine.prokind = 'p' then
      execute format(
        'alter procedure %I.%I(%s) set search_path = pg_catalog, pg_temp',
        routine.schema_name,
        routine.routine_name,
        routine.identity_arguments
      );
    else
      execute format(
        'alter function %I.%I(%s) set search_path = pg_catalog, pg_temp',
        routine.schema_name,
        routine.routine_name,
        routine.identity_arguments
      );
    end if;
  end loop;
end $$;

-- Post-batch release hardening.
-- Task 39 originally hardened the then-current SECURITY DEFINER catalog, but later
-- Customer Economics migrations added new SECURITY DEFINER routines. Re-apply the
-- same invariant after the complete current migration chain so every public/private
-- SECURITY DEFINER routine ends with pg_catalog first and pg_temp explicitly last.
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

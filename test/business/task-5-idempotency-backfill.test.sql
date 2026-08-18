do $$
begin
  if (
    select creation_request_id is null
    from public.businesses
    where id = 'b4444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'pre-existing business was not backfilled';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_creation_request_id_present'
      and conrelid = 'public.businesses'::regclass
      and convalidated
  ) then
    raise exception 'creation request presence check is not validated';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'creation_request_id'
      and is_nullable = 'NO'
  ) then
    raise exception 'creation request id is not NOT NULL';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_owner_creation_request_unique'
      and conrelid = 'public.businesses'::regclass
      and contype = 'u'
  ) then
    raise exception 'creation request unique constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_index as index_row
    join pg_class as index_class on index_class.oid = index_row.indexrelid
    where index_class.relname = 'businesses_owner_creation_request_unique'
      and index_row.indisvalid
      and index_row.indisready
  ) then
    raise exception 'creation request unique index is not valid and ready';
  end if;
end $$;

delete from public.businesses
where id = 'b4444444-4444-4444-8444-444444444444';

delete from auth.users
where id = '44444444-4444-4444-8444-444444444444';

create or replace function public.admin_mentee_directory()
returns table (
  mentee_user_id uuid,
  mentee_email text,
  mentee_created_at timestamptz,
  business_id uuid,
  business_name text,
  base_currency text,
  timezone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to view the mentee directory.';
  end if;

  if not (select private.is_admin()) then
    raise insufficient_privilege using message = 'Only an admin can view the mentee directory.';
  end if;

  return query
  select
    user_row.id,
    user_row.email,
    user_row.created_at,
    business_row.id,
    business_row.name,
    business_row.base_currency,
    business_row.timezone
  from auth.users as user_row
  left join public.businesses as business_row
    on business_row.owner_user_id = user_row.id
  where user_row.raw_app_meta_data ->> 'role' = 'mentee'
  order by
    pg_catalog.lower(coalesce(user_row.email, '')),
    business_row.created_at asc nulls last,
    business_row.id asc nulls last;
end;
$$;

revoke all on function public.admin_mentee_directory() from public;
revoke all on function public.admin_mentee_directory() from anon;
revoke all on function public.admin_mentee_directory() from authenticated;
grant execute on function public.admin_mentee_directory() to authenticated;
grant execute on function public.admin_mentee_directory() to service_role;

comment on function public.admin_mentee_directory() is
  'Task 35 admin-only mentee directory. The database verifies the caller is an authenticated Mizan admin before exposing mentee identity and owned-business metadata.';

create or replace function private.protect_business_monthly_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.monthly_periods
    where business_id = old.id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Business has protected monthly financial history.';
  end if;

  return old;
end;
$$;

revoke all on function private.protect_business_monthly_history() from public;
revoke all on function private.protect_business_monthly_history() from anon;
revoke all on function private.protect_business_monthly_history() from authenticated;

drop trigger if exists protect_business_monthly_history on public.businesses;
create trigger protect_business_monthly_history
  before delete on public.businesses
  for each row execute function private.protect_business_monthly_history();

create or replace function private.protect_funnel_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id is distinct from new.id then
    raise exception 'funnel id is immutable'
      using errcode = '42501';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'funnel created_at is immutable'
      using errcode = '42501';
  end if;

  if old.creation_request_id is distinct from new.creation_request_id then
    raise exception 'funnel creation request id is immutable'
      using errcode = '42501';
  end if;

  if old.business_id is distinct from new.business_id then
    raise exception 'funnel business id is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.protect_funnel_identity() from public;
revoke all on function private.protect_funnel_identity() from anon;
revoke all on function private.protect_funnel_identity() from authenticated;

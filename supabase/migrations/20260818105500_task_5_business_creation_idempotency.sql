alter table public.businesses
  add column creation_request_id uuid not null default gen_random_uuid();

alter table public.businesses
  add constraint businesses_owner_creation_request_unique
  unique (owner_user_id, creation_request_id);

create or replace function private.prevent_business_creation_request_id_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.creation_request_id is distinct from new.creation_request_id then
    raise exception 'business creation request id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_business_creation_request_id_update() from public;
revoke all on function private.prevent_business_creation_request_id_update() from anon;
revoke all on function private.prevent_business_creation_request_id_update() from authenticated;

create trigger prevent_business_creation_request_id_update
  before update of creation_request_id on public.businesses
  for each row execute function private.prevent_business_creation_request_id_update();

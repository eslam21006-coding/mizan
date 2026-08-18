alter table public.businesses
  add column creation_request_id uuid not null default gen_random_uuid();

alter table public.businesses
  add constraint businesses_owner_creation_request_unique
  unique (owner_user_id, creation_request_id);

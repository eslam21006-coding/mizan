alter table public.businesses
  add constraint businesses_creation_request_id_present
  check (creation_request_id is not null) not valid;

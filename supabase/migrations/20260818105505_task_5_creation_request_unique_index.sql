create unique index concurrently businesses_owner_creation_request_unique
  on public.businesses (owner_user_id, creation_request_id);

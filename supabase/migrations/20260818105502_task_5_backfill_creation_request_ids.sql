update public.businesses
set creation_request_id = gen_random_uuid()
where creation_request_id is null;

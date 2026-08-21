begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '51515151-5151-4515-8515-515151515151',
  'task14-retention-owner@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  'a5151515-5151-4515-8515-515151515151',
  'Task 14 Retention Business',
  'EGP',
  'Africa/Cairo',
  '51515151-5151-4515-8515-515151515151',
  'b5151515-5151-4515-8515-515151515151'
);

insert into public.funnels (
  id, business_id, name, funnel_type, creation_request_id
)
values (
  'c5151515-5151-4515-8515-515151515151',
  'a5151515-5151-4515-8515-515151515151',
  'Retention Funnel',
  'webinar',
  'd5151515-5151-4515-8515-515151515151'
);

do $$
begin
  begin
    delete from public.businesses
    where id = 'a5151515-5151-4515-8515-515151515151';

    raise exception 'business deletion cascaded through funnel history';
  exception when foreign_key_violation then
    null;
  end;

  if not exists (
    select 1 from public.businesses
    where id = 'a5151515-5151-4515-8515-515151515151'
  ) then
    raise exception 'business disappeared after restricted delete';
  end if;

  if not exists (
    select 1 from public.funnels
    where id = 'c5151515-5151-4515-8515-515151515151'
      and business_id = 'a5151515-5151-4515-8515-515151515151'
  ) then
    raise exception 'funnel history disappeared after restricted business delete';
  end if;
end $$;

rollback;

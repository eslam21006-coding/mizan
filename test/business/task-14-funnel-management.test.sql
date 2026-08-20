begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('14141414-1414-4414-8414-141414141414', 'task14-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('24242424-2424-4424-8424-242424242424', 'task14-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('34343434-3434-4434-8434-343434343434', 'task14-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'task14-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'a1414141-1414-4414-8414-141414141414',
    'Task 14 Business A',
    'EGP',
    'Africa/Cairo',
    '14141414-1414-4414-8414-141414141414',
    '51414141-1414-4414-8414-141414141414'
  ),
  (
    'b2424242-2424-4424-8424-242424242424',
    'Task 14 Business B',
    'SAR',
    'Asia/Riyadh',
    '24242424-2424-4424-8424-242424242424',
    '62424242-2424-4424-8424-242424242424'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'a1414141-1414-4414-8414-141414141414',
  '34343434-3434-4434-8434-343434343434',
  'member'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"14141414-1414-4414-8414-141414141414","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.funnels (
  id, business_id, name, funnel_type, creation_request_id
)
values (
  '71414141-1414-4414-8414-141414141414',
  'a1414141-1414-4414-8414-141414141414',
  'Main Webinar',
  'webinar',
  '81414141-1414-4414-8414-141414141414'
);

do $$
begin
  if (select count(*) from public.funnels) <> 1 then
    raise exception 'owner could not read own funnel';
  end if;

  begin
    insert into public.funnels (business_id, name, funnel_type, creation_request_id)
    values (
      'b2424242-2424-4424-8424-242424242424',
      'Spoofed Funnel',
      'event',
      '92424242-2424-4424-8424-242424242424'
    );
    raise exception 'owner A created a funnel inside owner B business';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.funnels (business_id, name, funnel_type)
    values (
      'a1414141-1414-4414-8414-141414141414',
      'Missing Request ID',
      'lead_gen'
    );
    raise exception 'creation without request id succeeded';
  exception when not_null_violation then
    null;
  end;

  begin
    insert into public.funnels (business_id, name, funnel_type, creation_request_id)
    values (
      'a1414141-1414-4414-8414-141414141414',
      'Duplicate Delivery',
      'low_ticket',
      '81414141-1414-4414-8414-141414141414'
    );
    raise exception 'duplicate request id created a second funnel';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.funnels (business_id, name, funnel_type, creation_request_id)
    values (
      'a1414141-1414-4414-8414-141414141414',
      'Invalid Type',
      'sales_call',
      'a1414141-1414-4414-8414-141414141415'
    );
    raise exception 'invalid funnel type succeeded';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.funnels (business_id, name, funnel_type, creation_request_id)
    values (
      'a1414141-1414-4414-8414-141414141414',
      '  Padded Name  ',
      'organic',
      'a1414141-1414-4414-8414-141414141416'
    );
    raise exception 'untrimmed funnel name succeeded';
  exception when check_violation then
    null;
  end;

  begin
    update public.funnels
    set creation_request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where id = '71414141-1414-4414-8414-141414141414';
    raise exception 'creation request id was mutable';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.funnels
    where id = '71414141-1414-4414-8414-141414141414';
    raise exception 'authenticated owner hard-deleted a funnel';
  exception when insufficient_privilege then
    null;
  end;
end $$;

update public.funnels
set name = 'Updated Webinar',
    funnel_type = 'event',
    is_active = false
where id = '71414141-1414-4414-8414-141414141414';

do $$
begin
  if not exists (
    select 1
    from public.funnels
    where id = '71414141-1414-4414-8414-141414141414'
      and name = 'Updated Webinar'
      and funnel_type = 'event'
      and is_active = false
      and creation_request_id = '81414141-1414-4414-8414-141414141414'
  ) then
    raise exception 'owner update did not persist correctly';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"24242424-2424-4424-8424-242424242424","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.funnels (
  id, business_id, name, funnel_type, creation_request_id
)
values (
  '72424242-2424-4424-8424-242424242424',
  'b2424242-2424-4424-8424-242424242424',
  'Referral Funnel',
  'referral',
  '82424242-2424-4424-8424-242424242424'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"14141414-1414-4414-8414-141414141414","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if exists (
    select 1 from public.funnels
    where id = '72424242-2424-4424-8424-242424242424'
  ) then
    raise exception 'owner A can read owner B funnel';
  end if;

  update public.funnels
  set name = 'Cross Tenant Update'
  where id = '72424242-2424-4424-8424-242424242424';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A updated owner B funnel';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"34343434-3434-4434-8434-343434343434","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if (select count(*) from public.funnels) <> 1 then
    raise exception 'business member could not read business funnels';
  end if;

  update public.funnels
  set name = 'Member Update'
  where id = '71414141-1414-4414-8414-141414141414';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'business member modified a funnel';
  end if;

  begin
    insert into public.funnels (business_id, name, funnel_type, creation_request_id)
    values (
      'a1414141-1414-4414-8414-141414141414',
      'Member Insert',
      'webinar',
      '93434343-3434-4434-8434-343434343434'
    );
    raise exception 'business member inserted a funnel';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"role":"admin"}}';

insert into public.funnels (business_id, name, funnel_type, creation_request_id)
values (
  'b2424242-2424-4424-8424-242424242424',
  'Admin Event',
  'event',
  '94444444-4444-4444-8444-444444444444'
);

update public.funnels
set is_active = false
where business_id = 'b2424242-2424-4424-8424-242424242424';

do $$
begin
  if (select count(*) from public.funnels) <> 3 then
    raise exception 'admin could not read all funnels';
  end if;

  if exists (
    select 1 from public.funnels
    where business_id = 'b2424242-2424-4424-8424-242424242424'
      and is_active
  ) then
    raise exception 'admin update did not persist';
  end if;

  begin
    update public.funnels
    set business_id = 'b2424242-2424-4424-8424-242424242424'
    where id = '71414141-1414-4414-8414-141414141414';
    raise exception 'admin moved funnel between businesses';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;

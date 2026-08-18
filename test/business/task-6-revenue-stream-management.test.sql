begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('16161616-1616-4616-8616-161616161616', 'task6-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('26262626-2626-4626-8626-262626262626', 'task6-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('36363636-3636-4636-8636-363636363636', 'task6-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('46464646-4646-4646-8646-464646464646', 'task6-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'a6161616-1616-4616-8616-161616161616',
    'Task 6 Business A',
    'EGP',
    'Africa/Cairo',
    '16161616-1616-4616-8616-161616161616',
    '56161616-1616-4616-8616-161616161616'
  ),
  (
    'b6262626-2626-4626-8626-262626262626',
    'Task 6 Business B',
    'SAR',
    'Asia/Riyadh',
    '26262626-2626-4626-8626-262626262626',
    '66262626-2626-4626-8626-262626262626'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'a6161616-1616-4616-8616-161616161616',
  '36363636-3636-4636-8636-363636363636',
  'member'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"16161616-1616-4616-8616-161616161616","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.revenue_streams (
  id, business_id, name, stream_type, creation_request_id
)
values (
  '71616161-1616-4616-8616-161616161616',
  'a6161616-1616-4616-8616-161616161616',
  'Front Offer',
  'front_end',
  '81616161-1616-4616-8616-161616161616'
);

do $$
begin
  if (select count(*) from public.revenue_streams) <> 1 then
    raise exception 'owner could not read own revenue stream';
  end if;

  begin
    insert into public.revenue_streams (
      business_id, name, stream_type, creation_request_id
    )
    values (
      'b6262626-2626-4626-8626-262626262626',
      'Spoofed Stream',
      'backend',
      '92626262-2626-4626-8626-262626262626'
    );
    raise exception 'owner A created a stream inside owner B business';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.revenue_streams (
      business_id, name, stream_type
    )
    values (
      'a6161616-1616-4616-8616-161616161616',
      'Missing Request ID',
      'backend'
    );
    raise exception 'creation without request id succeeded';
  exception when not_null_violation then
    null;
  end;

  begin
    insert into public.revenue_streams (
      business_id, name, stream_type, creation_request_id
    )
    values (
      'a6161616-1616-4616-8616-161616161616',
      'Duplicate Delivery',
      'front_end',
      '81616161-1616-4616-8616-161616161616'
    );
    raise exception 'duplicate request id created a second stream';
  exception when unique_violation then
    null;
  end;

  begin
    update public.revenue_streams
    set creation_request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where id = '71616161-1616-4616-8616-161616161616';
    raise exception 'creation request id was mutable';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.revenue_streams
    set business_id = 'b6262626-2626-4626-8626-262626262626'
    where id = '71616161-1616-4616-8616-161616161616';
    raise exception 'owner moved stream into another owner business';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.revenue_streams
    where id = '71616161-1616-4616-8616-161616161616';
    raise exception 'authenticated owner hard-deleted a revenue stream';
  exception when insufficient_privilege then
    null;
  end;
end $$;

update public.revenue_streams
set name = 'Updated Front Offer',
    stream_type = 'backend',
    is_active = false
where id = '71616161-1616-4616-8616-161616161616';

do $$
begin
  if not exists (
    select 1
    from public.revenue_streams
    where id = '71616161-1616-4616-8616-161616161616'
      and name = 'Updated Front Offer'
      and stream_type = 'backend'
      and is_active = false
      and creation_request_id = '81616161-1616-4616-8616-161616161616'
  ) then
    raise exception 'owner update did not persist correctly';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"26262626-2626-4626-8626-262626262626","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.revenue_streams (
  id, business_id, name, stream_type, creation_request_id
)
values (
  '72626262-2626-4626-8626-262626262626',
  'b6262626-2626-4626-8626-262626262626',
  'Backend Offer',
  'backend',
  '82626262-2626-4626-8626-262626262626'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"16161616-1616-4616-8616-161616161616","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if exists (
    select 1
    from public.revenue_streams
    where id = '72626262-2626-4626-8626-262626262626'
  ) then
    raise exception 'owner A can read owner B revenue stream';
  end if;

  update public.revenue_streams
  set name = 'Cross Tenant Update'
  where id = '72626262-2626-4626-8626-262626262626';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A updated owner B revenue stream';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"36363636-3636-4636-8636-363636363636","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if (select count(*) from public.revenue_streams) <> 1 then
    raise exception 'business member could not read business revenue streams';
  end if;

  update public.revenue_streams
  set name = 'Member Update'
  where id = '71616161-1616-4616-8616-161616161616';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'business member modified a revenue stream';
  end if;

  begin
    insert into public.revenue_streams (
      business_id, name, stream_type, creation_request_id
    )
    values (
      'a6161616-1616-4616-8616-161616161616',
      'Member Insert',
      'front_end',
      '93636363-3636-4636-8636-363636363636'
    );
    raise exception 'business member inserted a revenue stream';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"46464646-4646-4646-8646-464646464646","role":"authenticated","app_metadata":{"role":"admin"}}';

insert into public.revenue_streams (
  business_id, name, stream_type, creation_request_id
)
values (
  'b6262626-2626-4626-8626-262626262626',
  'Admin Managed',
  'backend',
  '94646464-4646-4646-8646-464646464646'
);

update public.revenue_streams
set is_active = false
where business_id = 'b6262626-2626-4626-8626-262626262626';

do $$
begin
  if (select count(*) from public.revenue_streams) <> 3 then
    raise exception 'admin could not read all revenue streams';
  end if;

  if exists (
    select 1
    from public.revenue_streams
    where business_id = 'b6262626-2626-4626-8626-262626262626'
      and is_active
  ) then
    raise exception 'admin update did not persist';
  end if;
end $$;

rollback;

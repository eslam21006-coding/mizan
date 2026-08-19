begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('17171717-1717-4717-8717-171717171717', 'task7-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('27272727-2727-4727-8727-272727272727', 'task7-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('37373737-3737-4737-8737-373737373737', 'task7-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('47474747-4747-4747-8747-474747474747', 'task7-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'a7171717-1717-4717-8717-171717171717',
    'Task 7 Business A',
    'EGP',
    'Africa/Cairo',
    '17171717-1717-4717-8717-171717171717',
    '57171717-1717-4717-8717-171717171717'
  ),
  (
    'b7272727-2727-4727-8727-272727272727',
    'Task 7 Business B',
    'SAR',
    'Asia/Riyadh',
    '27272727-2727-4727-8727-272727272727',
    '67272727-2727-4727-8727-272727272727'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'a7171717-1717-4717-8717-171717171717',
  '37373737-3737-4737-8737-373737373737',
  'member'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"17171717-1717-4717-8717-171717171717","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values (
  '71717171-1717-4717-8717-171717171717',
  'a7171717-1717-4717-8717-171717171717',
  'Meta Ads',
  'acquisition',
  'fixed_monthly',
  '81717171-1717-4717-8717-171717171717'
);

do $$
begin
  if (select count(*) from public.expense_items) <> 1 then
    raise exception 'owner could not read own expense item';
  end if;

  begin
    insert into public.expense_items (
      business_id, name, category, cost_behavior, creation_request_id
    ) values (
      'b7272727-2727-4727-8727-272727272727',
      'Cross Business',
      'overhead',
      'fixed_monthly',
      '92727272-2727-4727-8727-272727272727'
    );
    raise exception 'owner A created an expense inside owner B business';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.expense_items (
      business_id, name, category, cost_behavior, creation_request_id
    ) values (
      'a7171717-1717-4717-8717-171717171717',
      'Bad Category',
      'refund',
      'fixed_monthly',
      '91717171-1717-4717-8717-171717171717'
    );
    raise exception 'invalid category succeeded';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.expense_items (
      business_id, name, category, cost_behavior, creation_request_id
    ) values (
      'a7171717-1717-4717-8717-171717171717',
      'Bad Behavior',
      'overhead',
      'annual',
      'a1717171-1717-4717-8717-171717171717'
    );
    raise exception 'invalid cost behavior succeeded';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.expense_items (
      business_id, name, category, cost_behavior, creation_request_id
    ) values (
      'a7171717-1717-4717-8717-171717171717',
      'Duplicate Delivery',
      'acquisition',
      'fixed_monthly',
      '81717171-1717-4717-8717-171717171717'
    );
    raise exception 'duplicate request id created a second expense item';
  exception when unique_violation then
    null;
  end;

  begin
    update public.expense_items
    set creation_request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where id = '71717171-1717-4717-8717-171717171717';
    raise exception 'creation request id was mutable';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.expense_items
    set business_id = 'b7272727-2727-4727-8727-272727272727'
    where id = '71717171-1717-4717-8717-171717171717';
    raise exception 'owner moved expense item into another owner business';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.expense_items
    where id = '71717171-1717-4717-8717-171717171717';
    raise exception 'authenticated owner hard-deleted an expense item';
  exception when insufficient_privilege then
    null;
  end;
end $$;

update public.expense_items
set name = 'Coach Delivery',
    category = 'fulfillment',
    cost_behavior = 'per_customer',
    is_active = false
where id = '71717171-1717-4717-8717-171717171717';

do $$
begin
  if not exists (
    select 1
    from public.expense_items
    where id = '71717171-1717-4717-8717-171717171717'
      and name = 'Coach Delivery'
      and category = 'fulfillment'
      and cost_behavior = 'per_customer'
      and is_active = false
      and creation_request_id = '81717171-1717-4717-8717-171717171717'
  ) then
    raise exception 'owner update did not persist correctly';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"27272727-2727-4727-8727-272727272727","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values (
  '72727272-2727-4727-8727-272727272727',
  'b7272727-2727-4727-8727-272727272727',
  'Processor Fees',
  'financial',
  'percentage_revenue',
  '82727272-2727-4727-8727-272727272727'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"17171717-1717-4717-8717-171717171717","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if exists (
    select 1 from public.expense_items
    where id = '72727272-2727-4727-8727-272727272727'
  ) then
    raise exception 'owner A can read owner B expense item';
  end if;

  update public.expense_items
  set name = 'Cross Tenant Update'
  where id = '72727272-2727-4727-8727-272727272727';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'owner A updated owner B expense item';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"37373737-3737-4737-8737-373737373737","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  affected integer;
begin
  if (select count(*) from public.expense_items) <> 1 then
    raise exception 'business member could not read business expense items';
  end if;

  update public.expense_items
  set name = 'Member Update'
  where id = '71717171-1717-4717-8717-171717171717';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'business member modified an expense item';
  end if;

  begin
    insert into public.expense_items (
      business_id, name, category, cost_behavior, creation_request_id
    ) values (
      'a7171717-1717-4717-8717-171717171717',
      'Member Insert',
      'overhead',
      'fixed_monthly',
      '93737373-3737-4737-8737-373737373737'
    );
    raise exception 'business member inserted an expense item';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"47474747-4747-4747-8747-474747474747","role":"authenticated","app_metadata":{"role":"admin"}}';

insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
) values (
  'b7272727-2727-4727-8727-272727272727',
  'Admin Overhead',
  'overhead',
  'fixed_monthly',
  '94747474-4747-4747-8747-474747474747'
);

update public.expense_items
set is_active = false
where business_id = 'b7272727-2727-4727-8727-272727272727';

do $$
begin
  if (select count(*) from public.expense_items) <> 3 then
    raise exception 'admin could not read all expense items';
  end if;

  if exists (
    select 1 from public.expense_items
    where business_id = 'b7272727-2727-4727-8727-272727272727'
      and is_active
  ) then
    raise exception 'admin update did not persist';
  end if;
end $$;

rollback;

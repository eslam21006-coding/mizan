begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('15151515-1515-4515-8515-151515151515', 'task15-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('25252525-2525-4525-8525-252525252525', 'task15-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('35353535-3535-4535-8535-353535353535', 'task15-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('45454545-4545-4545-8545-454545454545', 'task15-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values
  (
    'a1515151-1515-4515-8515-151515151515',
    'Task 15 Business A',
    'EGP',
    'Africa/Cairo',
    '15151515-1515-4515-8515-151515151515',
    '51515151-1515-4515-8515-151515151515'
  ),
  (
    'b2525252-2525-4525-8525-252525252525',
    'Task 15 Business B',
    'SAR',
    'Asia/Riyadh',
    '25252525-2525-4525-8525-252525252525',
    '62525252-2525-4525-8525-252525252525'
  );

insert into public.business_memberships (business_id, user_id, membership_role)
values (
  'a1515151-1515-4515-8515-151515151515',
  '35353535-3535-4535-8535-353535353535',
  'member'
);

insert into public.funnels (
  id, business_id, name, funnel_type, creation_request_id
)
values
  (
    '71515151-1515-4515-8515-151515151515',
    'a1515151-1515-4515-8515-151515151515',
    'Original Webinar',
    'webinar',
    '81515151-1515-4515-8515-151515151515'
  ),
  (
    '72525252-2525-4525-8525-252525252525',
    'b2525252-2525-4525-8525-252525252525',
    'Business B Event',
    'event',
    '82525252-2525-4525-8525-252525252525'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"15151515-1515-4515-8515-151515151515","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.save_funnel_monthly_actuals(
  'a1515151-1515-4515-8515-151515151515',
  '2026-05-01',
  1000,
  '[{
    "funnel_id":"71515151-1515-4515-8515-151515151515",
    "ad_spend":"1000",
    "leads":100,
    "booked_calls":20,
    "showed_calls":13,
    "qualified_calls":10,
    "sales":2,
    "new_customers":2,
    "cash_collected":"5000",
    "attributed_revenue":null
  }]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.funnel_monthly_periods
    where business_id = 'a1515151-1515-4515-8515-151515151515'
      and month_start = '2026-05-01'
      and business_ad_spend = 1000
  ) then
    raise exception 'owner monthly funnel period did not persist';
  end if;

  if not exists (
    select 1
    from public.funnel_monthly_entries e
    join public.funnel_monthly_periods p on p.id = e.funnel_monthly_period_id
    where p.business_id = 'a1515151-1515-4515-8515-151515151515'
      and p.month_start = '2026-05-01'
      and e.funnel_id = '71515151-1515-4515-8515-151515151515'
      and e.funnel_name_snapshot = 'Original Webinar'
      and e.funnel_type_snapshot = 'webinar'
      and e.ad_spend = 1000
      and e.leads = 100
      and e.attributed_revenue is null
  ) then
    raise exception 'owner funnel entry or snapshots did not persist';
  end if;

  begin
    insert into public.funnel_monthly_periods (business_id, month_start)
    values ('a1515151-1515-4515-8515-151515151515', '2026-07-01');
    raise exception 'authenticated owner directly inserted funnel monthly period';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.funnel_monthly_entries;
    raise exception 'authenticated owner hard-deleted funnel monthly entries';
  exception when insufficient_privilege then
    null;
  end;
end $$;

update public.funnels
set name = 'Renamed Later', funnel_type = 'event', is_active = false
where id = '71515151-1515-4515-8515-151515151515';

select public.save_funnel_monthly_actuals(
  'a1515151-1515-4515-8515-151515151515',
  '2026-05-01',
  null,
  '[{
    "funnel_id":"71515151-1515-4515-8515-151515151515",
    "ad_spend":"0",
    "leads":null,
    "booked_calls":0,
    "showed_calls":0,
    "qualified_calls":0,
    "sales":0,
    "new_customers":0,
    "cash_collected":"0",
    "attributed_revenue":"-500"
  }]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.funnel_monthly_entries e
    join public.funnel_monthly_periods p on p.id = e.funnel_monthly_period_id
    where p.business_id = 'a1515151-1515-4515-8515-151515151515'
      and p.month_start = '2026-05-01'
      and p.business_ad_spend is null
      and e.funnel_name_snapshot = 'Original Webinar'
      and e.funnel_type_snapshot = 'webinar'
      and e.ad_spend = 0
      and e.leads is null
      and e.booked_calls = 0
      and e.attributed_revenue = -500
  ) then
    raise exception 'missing-vs-zero or historical funnel snapshots were not preserved';
  end if;

  begin
    perform public.save_funnel_monthly_actuals(
      'a1515151-1515-4515-8515-151515151515',
      '2026-06-01',
      0,
      '[{"funnel_id":"71515151-1515-4515-8515-151515151515","ad_spend":"0"}]'::jsonb
    );
    raise exception 'inactive funnel was added to a new monthly period';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_funnel_monthly_actuals(
      'a1515151-1515-4515-8515-151515151515',
      '2026-05-01',
      0,
      '[{"funnel_id":"71515151-1515-4515-8515-151515151515","cash_collected":"-1"}]'::jsonb
    );
    raise exception 'negative cash collected was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_funnel_monthly_actuals(
      'b2525252-2525-4525-8525-252525252525',
      '2026-05-01',
      100,
      '[{"funnel_id":"72525252-2525-4525-8525-252525252525","ad_spend":"100"}]'::jsonb
    );
    raise exception 'owner A wrote funnel data into owner B business';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"25252525-2525-4525-8525-252525252525","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1
    from public.funnel_monthly_periods
    where business_id = 'a1515151-1515-4515-8515-151515151515'
  ) then
    raise exception 'unrelated mentee read owner A funnel monthly period';
  end if;

  if exists (
    select 1
    from public.funnel_monthly_entries
    where business_id = 'a1515151-1515-4515-8515-151515151515'
  ) then
    raise exception 'unrelated mentee read owner A funnel monthly entries';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"35353535-3535-4535-8535-353535353535","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if (select count(*) from public.funnel_monthly_periods) <> 1 then
    raise exception 'business member could not read funnel monthly period';
  end if;

  if (select count(*) from public.funnel_monthly_entries) <> 1 then
    raise exception 'business member could not read funnel monthly entry';
  end if;

  begin
    perform public.save_funnel_monthly_actuals(
      'a1515151-1515-4515-8515-151515151515',
      '2026-05-01',
      999,
      '[]'::jsonb
    );
    raise exception 'read-only business member changed funnel monthly actuals';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"45454545-4545-4545-8545-454545454545","role":"authenticated","app_metadata":{"role":"admin"}}';

select public.save_funnel_monthly_actuals(
  'b2525252-2525-4525-8525-252525252525',
  '2026-05-01',
  250,
  '[{
    "funnel_id":"72525252-2525-4525-8525-252525252525",
    "ad_spend":"250",
    "leads":25,
    "new_customers":5,
    "attributed_revenue":"500"
  }]'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from public.funnel_monthly_periods
    where business_id = 'b2525252-2525-4525-8525-252525252525'
      and business_ad_spend = 250
  ) then
    raise exception 'admin could not manage another business funnel month';
  end if;
end $$;

reset role;

do $$
begin
  begin
    update public.funnel_monthly_entries
    set funnel_name_snapshot = 'Corrupted Snapshot'
    where funnel_id = '71515151-1515-4515-8515-151515151515';
    raise exception 'funnel monthly snapshot was mutable';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.funnel_monthly_periods
    set month_start = '2026-04-01'
    where business_id = 'a1515151-1515-4515-8515-151515151515';
    raise exception 'funnel monthly period identity was mutable';
  exception when insufficient_privilege then
    null;
  end;
end $$;

set local role anon;

do $$
begin
  begin
    perform 1 from public.funnel_monthly_periods;
    raise exception 'anon read funnel monthly periods';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.save_funnel_monthly_actuals(
      'a1515151-1515-4515-8515-151515151515',
      '2026-05-01',
      1,
      '[]'::jsonb
    );
    raise exception 'anon executed funnel monthly save RPC';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
rollback;

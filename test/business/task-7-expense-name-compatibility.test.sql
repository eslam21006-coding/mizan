begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values (
  '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  'task7-trimmed-name@example.test',
  '{"role":"mentee"}'::jsonb,
  now(),
  now()
);

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
)
values (
  'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  'Task 7 Trimmed Name Compatibility',
  'EGP',
  'Africa/Cairo',
  '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  '5a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a","role":"authenticated","app_metadata":{"role":"mentee"}}';

insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
)
values (
  'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
  repeat('x', 120) || '   ',
  'overhead',
  'fixed_monthly',
  '6a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
);

do $$
begin
  if not exists (
    select 1
    from public.expense_items
    where business_id = 'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
      and char_length(btrim(name)) = 120
      and char_length(name) = 123
  ) then
    raise exception 'trimmed 120-character expense name was not preserved';
  end if;

  begin
    insert into public.expense_items (
      business_id, name, category, cost_behavior, creation_request_id
    ) values (
      'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
      E'\t\n  ',
      'overhead',
      'fixed_monthly',
      '7a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
    );
    raise exception 'whitespace-only expense name was accepted';
  exception when check_violation then
    null;
  end;
end $$;

rollback;

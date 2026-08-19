do $$
begin
  if not exists (
    select 1
    from public.expense_items
    where business_id = 'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a'
      and char_length(btrim(name)) = 120
      and char_length(name) = 123
  ) then
    raise exception 'preexisting trimmed 120-character expense name did not survive the migration chain';
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

delete from public.businesses
where id = 'a1a1a1a1-1a1a-4a1a-8a1a-1a1a1a1a1a1a';

delete from auth.users
where id = '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a';

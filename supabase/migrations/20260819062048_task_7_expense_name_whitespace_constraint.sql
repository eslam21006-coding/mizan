alter table public.expense_items
  drop constraint expense_items_name_check;

alter table public.expense_items
  add constraint expense_items_name_check check (
    char_length(name) between 1 and 120
    and name ~ '[^[:space:]]'
  );

alter table public.monthly_expense_entries
  alter column input_value type numeric(28,12)
  using input_value::numeric(28,12);

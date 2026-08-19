alter table public.monthly_revenue_entries
  alter constraint monthly_revenue_entries_stream_business_fk
  deferrable initially deferred;

alter table public.monthly_expense_entries
  alter constraint monthly_expense_entries_expense_business_fk
  deferrable initially deferred;

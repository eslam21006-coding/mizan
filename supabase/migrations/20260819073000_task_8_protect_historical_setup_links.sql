alter table public.monthly_revenue_entries
  drop constraint monthly_revenue_entries_stream_business_fk;

alter table public.monthly_revenue_entries
  add constraint monthly_revenue_entries_stream_business_fk
  foreign key (business_id, revenue_stream_id)
  references public.revenue_streams(business_id, id);

alter table public.monthly_expense_entries
  drop constraint monthly_expense_entries_expense_business_fk;

alter table public.monthly_expense_entries
  add constraint monthly_expense_entries_expense_business_fk
  foreign key (business_id, expense_item_id)
  references public.expense_items(business_id, id);

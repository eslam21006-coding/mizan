grant delete on public.revenue_streams to authenticated;
grant delete on public.expense_items to authenticated;

create policy revenue_streams_delete
on public.revenue_streams for delete
to authenticated
using ((select private.can_manage_business(business_id)));

create policy expense_items_delete
on public.expense_items for delete
to authenticated
using ((select private.can_manage_business(business_id)));

comment on policy revenue_streams_delete on public.revenue_streams is
  'Owners and admins may delete unused revenue streams. Existing foreign keys intentionally block deletion once a stream is referenced by historical monthly data or customer transactions.';

comment on policy expense_items_delete on public.expense_items is
  'Owners and admins may delete unused expense items. Existing foreign keys intentionally block deletion once an expense is referenced by historical monthly data or front-end allocations.';

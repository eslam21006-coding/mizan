alter table public.customer_transactions
  validate constraint customer_transactions_revenue_stream_business_fk;

alter table public.customer_transactions
  validate constraint customer_transactions_revenue_stream_snapshot_check;

comment on constraint customer_transactions_revenue_stream_snapshot_check
  on public.customer_transactions is
  'Task 24 revenue-stream snapshots preserve every stream type supported by Task 16: front_end, backend, and other. Null values represent explicitly unattributed transactions.';

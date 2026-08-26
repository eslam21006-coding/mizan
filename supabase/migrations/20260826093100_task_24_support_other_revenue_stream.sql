alter table public.customer_transactions
  drop constraint customer_transactions_revenue_stream_snapshot_check;

alter table public.customer_transactions
  add constraint customer_transactions_revenue_stream_snapshot_check
    check (
      (
        revenue_stream_id is null
        and revenue_stream_name_snapshot is null
        and revenue_stream_type_snapshot is null
      )
      or (
        revenue_stream_id is not null
        and revenue_stream_name_snapshot is not null
        and char_length(btrim(revenue_stream_name_snapshot)) between 1 and 120
        and revenue_stream_type_snapshot in ('front_end', 'backend', 'other')
      )
    );

comment on constraint customer_transactions_revenue_stream_snapshot_check
  on public.customer_transactions is
  'Task 24 revenue-stream snapshots preserve every stream type supported by Task 16: front_end, backend, and other. Null values represent explicitly unattributed transactions.';

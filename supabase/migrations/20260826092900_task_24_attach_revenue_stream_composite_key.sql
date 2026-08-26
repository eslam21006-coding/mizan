alter table public.revenue_streams
  add constraint revenue_streams_business_id_id_unique
  unique using index revenue_streams_business_id_id_unique;

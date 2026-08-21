alter table public.funnels
  drop constraint if exists funnels_business_id_fkey;

alter table public.funnels
  add constraint funnels_business_id_fkey
  foreign key (business_id)
  references public.businesses(id)
  on delete restrict;

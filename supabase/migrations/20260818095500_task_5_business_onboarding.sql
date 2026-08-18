alter table public.businesses
  add column timezone text not null default 'Africa/Cairo';

alter table public.businesses
  add constraint businesses_timezone_shape_check
  check (
    char_length(timezone) between 1 and 64
    and (
      timezone = 'UTC'
      or timezone ~ '^[A-Za-z][A-Za-z0-9_+.-]*(/[A-Za-z0-9_+.-]+)+$'
    )
  );

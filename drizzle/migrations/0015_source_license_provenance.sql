-- Open-licence provenance for imported sources (archive.org and similar).
-- Every imported video keeps the licence the source itself declares, next to the admin who
-- confirmed MOROBEST is allowed to distribute it.
alter table public.video_sources
  add column if not exists license_url text,
  add column if not exists license_note text,
  add column if not exists attribution text;

comment on column public.video_sources.license_url is 'Licence URL declared by the source (e.g. creativecommons.org/publicdomain/mark/1.0)';
comment on column public.video_sources.license_note is 'Human-readable licence statement captured at import time';
comment on column public.video_sources.attribution is 'Required credit line for the rights holder, when the licence asks for one';

-- Sources without a confirmed rightsholder signature must never look "production ready".
create or replace function public.source_is_cleared(_source uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.video_sources vs
    where vs.id = _source and vs.rights_confirmed_by is not null and vs.rights_confirmed_at is not null
  )
$$;
comment on function public.source_is_cleared(uuid) is 'True when an admin confirmed MOROBEST may distribute this source';
grant execute on function public.source_is_cleared(uuid) to authenticated;

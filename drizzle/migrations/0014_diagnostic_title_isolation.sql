alter table public.titles add column if not exists is_diagnostic boolean not null default false;
update public.titles set is_diagnostic = true where id = '1a8d23bf-b6bb-4349-b9d0-f81b87288c85';

-- Diagnostic titles' traffic is always internal/test.
create or replace function public.mark_diagnostic_events() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_test and (
    (new.title_id is not null and exists (select 1 from public.titles t where t.id = new.title_id and t.is_diagnostic))
    or (new.content_key like 'mb:%' and exists (select 1 from public.titles t where t.id::text = substr(new.content_key, 4) and t.is_diagnostic))
  ) then new.is_test := true; end if;
  return new;
end $$;
drop trigger if exists trg_mark_diagnostic_events on public.analytics_events;
create trigger trg_mark_diagnostic_events before insert on public.analytics_events for each row execute function public.mark_diagnostic_events();
update public.analytics_events set is_test = true where title_id = '1a8d23bf-b6bb-4349-b9d0-f81b87288c85' or content_key = 'mb:1a8d23bf-b6bb-4349-b9d0-f81b87288c85';

create or replace function public.trending_content(_days integer default 14, _limit integer default 20)
 returns table(content_key text, title_id uuid, score numeric, viewers bigint)
 language sql stable security definer set search_path to 'public'
as $function$
  with ev as (
    select public.analytics_key(e.content_key, e.title_id) k, e.title_id, e.visitor, e.occurred_at::date d, e.event, e.value
    from public.analytics_events e
    where not e.is_test
      and e.occurred_at > now() - make_interval(days => least(greatest(_days, 1), 60))
      and e.event in ('play_start','complete','watch_time','watchlist_add','favorite_add','search_click','click')
      and (e.content_key is not null or e.title_id is not null)
      and not exists (select 1 from public.titles t where t.id = e.title_id and t.is_diagnostic)
  ), per as (
    select k, d, visitor, max(title_id::text)::uuid title_id,
      bool_or(event = 'play_start') v, bool_or(event = 'complete') c, least(coalesce(sum(value) filter (where event = 'watch_time'), 0), 3 * 3600) w,
      bool_or(event = 'watchlist_add') wl, bool_or(event = 'favorite_add') fav,
      bool_or(event = 'search_click') sc, bool_or(event = 'click') cl
    from ev where k is not null group by k, d, visitor
  )
  select k, max(title_id::text)::uuid,
    round(sum(exp(-(current_date - d)::numeric / 4) * (
      (case when v then 3 else 0 end) + (case when c then 4 else 0 end) + (w / 600.0)
      + (case when wl then 2.5 else 0 end) + (case when fav then 2 else 0 end)
      + (case when sc then 1.5 else 0 end) + (case when cl then 1 else 0 end)))::numeric, 3) score,
    count(distinct visitor)
  from per
  where not (k like 'mb:%' and (not public.title_is_public(substr(k, 4)::uuid)
    or exists (select 1 from public.titles t where t.id::text = substr(k, 4) and t.is_diagnostic)))
  group by k
  order by 3 desc
  limit least(greatest(_limit, 1), 50)
$function$;
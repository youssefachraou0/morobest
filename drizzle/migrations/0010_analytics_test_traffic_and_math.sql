
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS analytics_events_test_idx ON public.analytics_events (is_test, occurred_at);
COMMENT ON COLUMN public.analytics_events.is_test IS 'Staff QA, test videos and automated tests; excluded from trending, rollups and default dashboard totals';

-- Remove the two development test rows created during the previous verification.
DELETE FROM public.analytics_events WHERE occurred_at = '2026-10-06 21:05:30+00' AND ((event = 'page_view' AND path = '/') OR (event = 'search' AND props->>'q' = 'fight club'));

CREATE TABLE IF NOT EXISTS public.analytics_meta (
  key text PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.analytics_meta TO service_role;
ALTER TABLE public.analytics_meta ENABLE ROW LEVEL SECURITY;

-- Rollups: test traffic excluded; a "view" is one playback start per visitor + title/episode + browser session.
CREATE OR REPLACE FUNCTION public.analytics_rollup(_day date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  insert into public.analytics_daily as d (day, content_key, title_id, views, unique_viewers, watch_seconds, starts, completions, errors, impressions, clicks, watchlist_adds, favorite_adds)
  select _day, k, max(title_id::text)::uuid,
    count(distinct (visitor, coalesce(episode_id::text,''), coalesce(session,''))) filter (where event = 'play_start'),
    count(distinct visitor) filter (where event = 'play_start'),
    coalesce(sum(value) filter (where event = 'watch_time'), 0)::bigint,
    count(*) filter (where event = 'play_start'),
    count(distinct (visitor, coalesce(episode_id::text,''), coalesce(session,''))) filter (where event = 'complete'),
    count(*) filter (where event = 'playback_error'),
    count(*) filter (where event = 'impression'),
    count(*) filter (where event in ('click','search_click')),
    count(*) filter (where event = 'watchlist_add'),
    count(*) filter (where event = 'favorite_add')
  from (select e.*, public.analytics_key(e.content_key, e.title_id) k from public.analytics_events e
        where not e.is_test and e.occurred_at >= _day and e.occurred_at < _day + 1 and (e.content_key is not null or e.title_id is not null)) x
  where k is not null
  group by k
  on conflict (day, content_key) do update set views = excluded.views, unique_viewers = excluded.unique_viewers, watch_seconds = excluded.watch_seconds,
    starts = excluded.starts, completions = excluded.completions, errors = excluded.errors, impressions = excluded.impressions,
    clicks = excluded.clicks, watchlist_adds = excluded.watchlist_adds, favorite_adds = excluded.favorite_adds, title_id = excluded.title_id
$$;

-- Retention: raw events 90 days, playback error log 180 days, crawler counters ~13 months, daily aggregates kept long-term.
CREATE OR REPLACE FUNCTION public.analytics_maintain()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_ev int; n_err int;
BEGIN
  PERFORM public.analytics_rollup(current_date - 1);
  PERFORM public.analytics_rollup(current_date);
  DELETE FROM public.analytics_events WHERE occurred_at < now() - interval '90 days'; GET DIAGNOSTICS n_ev = ROW_COUNT;
  DELETE FROM public.playback_errors WHERE created_at < now() - interval '180 days'; GET DIAGNOSTICS n_err = ROW_COUNT;
  DELETE FROM public.crawler_hits WHERE day < current_date - 400;
  INSERT INTO public.analytics_meta (key, ran_at, details) VALUES ('maintain', now(), jsonb_build_object('raw_deleted', n_ev, 'errors_deleted', n_err))
  ON CONFLICT (key) DO UPDATE SET ran_at = excluded.ran_at, details = excluded.details;
END $$;

-- Opportunistic, throttled: does the work at most once every 6 hours.
CREATE OR REPLACE FUNCTION public.analytics_maintain_if_due()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (select 1 from public.analytics_meta where key = 'maintain' and ran_at > now() - interval '6 hours') THEN RETURN false; END IF;
  PERFORM public.analytics_maintain();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.analytics_maintain_if_due() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_maintain_if_due() TO service_role;

CREATE OR REPLACE FUNCTION public.is_analytics_admin(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(_u, 'admin') or public.has_role(_u, 'super_admin')
$$;

-- Admin maintenance actions.
CREATE OR REPLACE FUNCTION public.admin_analytics_cleanup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_analytics_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public.analytics_maintain();
  RETURN (select jsonb_build_object('ran_at', ran_at) || details from public.analytics_meta where key = 'maintain');
END $$;
GRANT EXECUTE ON FUNCTION public.admin_analytics_cleanup() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_analytics_purge_test()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_analytics_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.analytics_events WHERE is_test; GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_analytics_purge_test() TO authenticated;

-- Trending excludes test/internal traffic.
CREATE OR REPLACE FUNCTION public.trending_content(_days integer DEFAULT 14, _limit integer DEFAULT 20)
RETURNS TABLE(content_key text, title_id uuid, score numeric, viewers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  with ev as (
    select public.analytics_key(e.content_key, e.title_id) k, e.title_id, e.visitor, e.occurred_at::date d, e.event, e.value
    from public.analytics_events e
    where not e.is_test
      and e.occurred_at > now() - make_interval(days => least(greatest(_days, 1), 60))
      and e.event in ('play_start','complete','watch_time','watchlist_add','favorite_add','search_click','click')
      and (e.content_key is not null or e.title_id is not null)
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
  where not (k like 'mb:%' and not public.title_is_public(substr(k, 4)::uuid))
  group by k
  order by 3 desc
  limit least(greatest(_limit, 1), 50)
$$;

DROP FUNCTION IF EXISTS public.analytics_dashboard(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_title(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_ctx(timestamptz, timestamptz);

/*
  Metric definitions (deterministic):
  - view            = distinct (visitor, title, episode, browser session) with a play_start. Refresh keeps the session, so it cannot add views.
  - unique viewers  = distinct visitor hashes with a play_start.
  - watch time      = sum of watch_time heartbeats (client counts only real, unpaused, visible playback; server clamps each to 1..60 s).
  - avg watch time  = watch time / views.
  - completion rate = distinct completed (visitor, unit, session) / views, capped at 100%.
  - failure rate    = attempts that errored and never started playback / all attempts. A successful fallback is not a failure.
  - episode drop-off= 1 - unique viewers(episode n) / unique viewers(first episode).
*/
CREATE OR REPLACE FUNCTION public.analytics_dashboard(_from timestamptz, _to timestamptz, _include_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH base AS (select * from public.analytics_events where (_include_test or not is_test)),
  e AS (select * from base where occurred_at >= _from and occurred_at < _to),
  att AS (
    select title_id, visitor, coalesce(episode_id::text,'') ep, coalesce(session,'') s,
      bool_or(event = 'play_start') started, bool_or(event = 'playback_error') errored, bool_or(event = 'complete') completed
    from e where title_id is not null and event in ('play_start','playback_error','complete') group by 1,2,3,4),
  pt AS (select title_id, event, visitor, value from e where title_id is not null)
  SELECT jsonb_build_object(
    'active_viewers', (select count(distinct visitor) from base where occurred_at > now() - interval '5 minutes' and event in ('watch_time','play_start','resume')),
    'views_today', (select count(distinct (visitor, title_id, coalesce(episode_id::text,''), coalesce(session,''))) from base where event = 'play_start' and occurred_at >= date_trunc('day', now())),
    'views_week', (select count(distinct (visitor, title_id, coalesce(episode_id::text,''), coalesce(session,''))) from base where event = 'play_start' and occurred_at >= now() - interval '7 days'),
    'views', (select count(*) from att where started),
    'unique_viewers', (select count(distinct visitor) from att where started),
    'page_views', (select count(*) from e where event = 'page_view'),
    'watch_seconds', (select coalesce(sum(value), 0) from e where event = 'watch_time'),
    'completions', (select count(*) from att where started and completed),
    'attempts', (select count(*) from att where started or errored),
    'failed', (select count(*) from att where errored and not started),
    'errors', (select count(*) from e where event = 'playback_error'),
    'fallbacks', (select count(*) from e where event = 'fallback'),
    'test_events', (select count(*) from public.analytics_events where is_test and occurred_at >= _from and occurred_at < _to),
    'titles', (select coalesce(jsonb_agg(t order by (t->>'views')::int desc), '[]') from (
        select jsonb_build_object('title_id', a.title_id, 'name', ti.original_title, 'slug', ti.slug, 'kind', ti.kind,
          'views', a.views, 'unique', a.uniq, 'completions', a.comp, 'attempts', a.attempts, 'failed', a.failed,
          'watch_seconds', coalesce((select sum(value) from pt where pt.title_id = a.title_id and pt.event = 'watch_time'), 0),
          'link', (select jsonb_build_object('provider', cl.provider, 'content_type', cl.content_type, 'provider_id', cl.provider_id) from public.content_links cl where cl.title_id = a.title_id and cl.is_primary limit 1)) t
        from (select title_id, count(*) filter (where started) views, count(distinct visitor) filter (where started) uniq,
                count(*) filter (where started and completed) comp, count(*) filter (where started or errored) attempts,
                count(*) filter (where errored and not started) failed from att group by title_id) a
        join public.titles ti on ti.id = a.title_id
        order by a.views desc limit 60) s),
    'searches', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('q', lower(props->>'q'), 'n', count(*)) s from e where event = 'search' and coalesce(props->>'q','') <> '' group by lower(props->>'q') order by count(*) desc limit 20) x),
    'subtitles', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('lang', coalesce(props->>'lang','off'), 'n', count(*)) s from e where event = 'subtitle_select' group by coalesce(props->>'lang','off') order by count(*) desc limit 10) x),
    'audio', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('lang', props->>'lang', 'n', count(*)) s from e where event = 'audio_select' and coalesce(props->>'lang','') <> '' group by props->>'lang' order by count(*) desc limit 10) x),
    'error_list', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('at', pe.created_at, 'provider', coalesce(pe.provider, 'source'), 'message', left(regexp_replace(pe.message, 'https?://\S+', '[url]', 'g'), 160)) s from public.playback_errors pe where pe.created_at >= _from and pe.created_at < _to order by pe.created_at desc limit 20) x),
    'events', (select coalesce(jsonb_object_agg(event, n), '{}') from (select event, count(*) n from e group by event) x),
    'ctx', (select coalesce(jsonb_object_agg(k, n), '{}') from (select event || ':' || coalesce(ctx, 'none') k, count(*) n from e where event in ('impression','click','search_click') group by 1) x)
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard(timestamptz, timestamptz, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_title(_title uuid, _from timestamptz, _to timestamptz, _include_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH e AS (select * from public.analytics_events where title_id = _title and occurred_at >= _from and occurred_at < _to and (_include_test or not is_test)),
  att AS (
    select episode_id, visitor, coalesce(session,'') s,
      bool_or(event = 'play_start') started, bool_or(event = 'playback_error') errored, bool_or(event = 'complete') completed
    from e where event in ('play_start','playback_error','complete') group by 1,2,3),
  ws AS (select episode_id, sum(value) w from e where event = 'watch_time' group by 1),
  eps AS (
    select ep.id, s.number season, ep.number, ep.title,
      count(*) filter (where a.started) views, count(distinct a.visitor) filter (where a.started) uniq,
      count(*) filter (where a.started and a.completed) comp,
      coalesce((select w from ws where ws.episode_id = ep.id), 0) w,
      row_number() over (order by s.number, ep.number) rn
    from public.episodes ep join public.seasons s on s.id = ep.season_id
    left join att a on a.episode_id = ep.id
    where s.title_id = _title group by ep.id, s.number, ep.number, ep.title)
  SELECT jsonb_build_object(
    'views', (select count(*) from att where started),
    'unique', (select count(distinct visitor) from att where started),
    'watch_seconds', (select coalesce(sum(value), 0) from e where event = 'watch_time'),
    'completions', (select count(*) from att where started and completed),
    'attempts', (select count(*) from att where started or errored),
    'failed', (select count(*) from att where errored and not started),
    'errors', (select count(*) from e where event = 'playback_error'),
    'episodes', (select coalesce(jsonb_agg(jsonb_build_object('episode_id', id, 'season', season, 'number', number, 'title', title,
        'views', views, 'unique', uniq, 'completions', comp, 'watch_seconds', w) order by rn), '[]') from eps)
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.analytics_title(uuid, timestamptz, timestamptz, boolean) TO authenticated;

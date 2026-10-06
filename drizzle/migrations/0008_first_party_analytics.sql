
CREATE TABLE public.analytics_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  visitor text NOT NULL,
  session text,
  content_key text,
  title_id uuid,
  episode_id uuid,
  ctx text,
  value numeric,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  path text
);
CREATE INDEX analytics_events_time_idx ON public.analytics_events (occurred_at);
CREATE INDEX analytics_events_event_time_idx ON public.analytics_events (event, occurred_at);
CREATE INDEX analytics_events_title_idx ON public.analytics_events (title_id, occurred_at) WHERE title_id IS NOT NULL;
CREATE INDEX analytics_events_key_idx ON public.analytics_events (content_key, occurred_at) WHERE content_key IS NOT NULL;
COMMENT ON TABLE public.analytics_events IS 'Raw first-party events, pseudonymous visitor hash only, kept 90 days then rolled up';
GRANT ALL ON public.analytics_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.analytics_events_id_seq TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.analytics_daily (
  day date NOT NULL,
  content_key text NOT NULL,
  title_id uuid,
  views integer NOT NULL DEFAULT 0,
  unique_viewers integer NOT NULL DEFAULT 0,
  watch_seconds bigint NOT NULL DEFAULT 0,
  starts integer NOT NULL DEFAULT 0,
  completions integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  watchlist_adds integer NOT NULL DEFAULT 0,
  favorite_adds integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, content_key)
);
COMMENT ON TABLE public.analytics_daily IS 'Long-term aggregated per-content daily statistics (no visitor data)';
GRANT ALL ON public.analytics_daily TO service_role;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.crawler_hits (
  day date NOT NULL,
  bot text NOT NULL,
  section text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, bot, section)
);
COMMENT ON TABLE public.crawler_hits IS 'SEO crawler traffic, kept separate from human analytics';
GRANT ALL ON public.crawler_hits TO service_role;
ALTER TABLE public.crawler_hits ENABLE ROW LEVEL SECURITY;

-- Content key for an event: provider key when a MOROBEST title is linked, else mb:<title_id>.
CREATE OR REPLACE FUNCTION public.analytics_key(_key text, _title uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(
    (select cl.provider || ':' || cl.content_type || ':' || cl.provider_id from public.content_links cl where cl.title_id = _title and cl.is_primary limit 1),
    _key, 'mb:' || _title::text)
$$;

CREATE OR REPLACE FUNCTION public.analytics_rollup(_day date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  insert into public.analytics_daily as d (day, content_key, title_id, views, unique_viewers, watch_seconds, starts, completions, errors, impressions, clicks, watchlist_adds, favorite_adds)
  select _day, k, max(title_id::text)::uuid,
    count(*) filter (where event = 'play_start'),
    count(distinct visitor) filter (where event = 'play_start'),
    coalesce(sum(value) filter (where event = 'watch_time'), 0)::bigint,
    count(*) filter (where event = 'play_start'),
    count(*) filter (where event = 'complete'),
    count(*) filter (where event = 'playback_error'),
    count(*) filter (where event = 'impression'),
    count(*) filter (where event in ('click','search_click')),
    count(*) filter (where event = 'watchlist_add'),
    count(*) filter (where event = 'favorite_add')
  from (select e.*, public.analytics_key(e.content_key, e.title_id) k from public.analytics_events e
        where e.occurred_at >= _day and e.occurred_at < _day + 1 and (e.content_key is not null or e.title_id is not null)) x
  where k is not null
  group by k
  on conflict (day, content_key) do update set views = excluded.views, unique_viewers = excluded.unique_viewers, watch_seconds = excluded.watch_seconds,
    starts = excluded.starts, completions = excluded.completions, errors = excluded.errors, impressions = excluded.impressions,
    clicks = excluded.clicks, watchlist_adds = excluded.watchlist_adds, favorite_adds = excluded.favorite_adds, title_id = excluded.title_id
$$;

-- Rolls up yesterday and today, then deletes raw events older than 90 days.
CREATE OR REPLACE FUNCTION public.analytics_maintain()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.analytics_rollup(current_date - 1);
  PERFORM public.analytics_rollup(current_date);
  DELETE FROM public.analytics_events WHERE occurred_at < now() - interval '90 days';
  DELETE FROM public.crawler_hits WHERE day < current_date - 400;
END $$;
REVOKE ALL ON FUNCTION public.analytics_maintain() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.analytics_rollup(date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_maintain() TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_rollup(date) TO service_role;

-- Behavioral trending: one signal per visitor per content per day (refresh spam cannot inflate), recency-decayed.
CREATE OR REPLACE FUNCTION public.trending_content(_days integer DEFAULT 14, _limit integer DEFAULT 20)
RETURNS TABLE(content_key text, title_id uuid, score numeric, viewers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  with ev as (
    select public.analytics_key(e.content_key, e.title_id) k, e.title_id, e.visitor, e.occurred_at::date d, e.event, e.value
    from public.analytics_events e
    where e.occurred_at > now() - make_interval(days => least(greatest(_days, 1), 60))
      and e.event in ('play_start','complete','watch_time','watchlist_add','favorite_add','search_click','click')
      and (e.content_key is not null or e.title_id is not null)
  ), per as (
    select k, d, visitor, max(title_id::text)::uuid title_id,
      bool_or(event = 'play_start') v, bool_or(event = 'complete') c, least(coalesce(sum(value) filter (where event = 'watch_time'), 0), 3 * 3600) w,
      bool_or(event = 'watchlist_add') wl, bool_or(event = 'favorite_add') fav,
      bool_or(event = 'search_click') sc, bool_or(event = 'click' ) cl
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
GRANT EXECUTE ON FUNCTION public.trending_content(integer, integer) TO anon, authenticated, service_role;

-- Admin dashboard (staff only).
CREATE OR REPLACE FUNCTION public.analytics_dashboard(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH e AS (select * from public.analytics_events where occurred_at >= _from and occurred_at < _to),
  pt AS (select public.analytics_key(content_key, title_id) k, title_id, event, visitor, value, props from e where title_id is not null)
  SELECT jsonb_build_object(
    'active_viewers', (select count(distinct visitor) from public.analytics_events where occurred_at > now() - interval '5 minutes' and event in ('watch_time','play_start','resume')),
    'views_today', (select count(*) from public.analytics_events where event = 'play_start' and occurred_at >= date_trunc('day', now())),
    'views_week', (select count(*) from public.analytics_events where event = 'play_start' and occurred_at >= now() - interval '7 days'),
    'views', (select count(*) from e where event = 'play_start'),
    'unique_viewers', (select count(distinct visitor) from e where event = 'play_start'),
    'page_views', (select count(*) from e where event = 'page_view'),
    'watch_seconds', (select coalesce(sum(value), 0) from e where event = 'watch_time'),
    'errors', (select count(*) from e where event = 'playback_error'),
    'fallbacks', (select count(*) from e where event = 'fallback'),
    'titles', (select coalesce(jsonb_agg(t order by t->>'views' desc), '[]') from (
        select jsonb_build_object('title_id', pt.title_id, 'name', ti.original_title, 'slug', ti.slug, 'kind', ti.kind,
          'views', count(*) filter (where event = 'play_start'), 'unique', count(distinct visitor) filter (where event = 'play_start'),
          'watch_seconds', coalesce(sum(value) filter (where event = 'watch_time'), 0),
          'completions', count(*) filter (where event = 'complete'), 'errors', count(*) filter (where event = 'playback_error')) t
        from pt join public.titles ti on ti.id = pt.title_id group by pt.title_id, ti.original_title, ti.slug, ti.kind
        order by count(*) filter (where event = 'play_start') desc limit 60) s),
    'searches', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('q', lower(props->>'q'), 'n', count(*), 'clicks', 0) s from e where event = 'search' and props ? 'q' group by lower(props->>'q') order by count(*) desc limit 20) x),
    'subtitles', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('lang', props->>'lang', 'n', count(*)) s from e where event = 'subtitle_select' group by props->>'lang' order by count(*) desc limit 10) x),
    'audio', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('lang', props->>'lang', 'n', count(*)) s from e where event in ('audio_select','play_start') and props ? 'lang' group by props->>'lang' order by count(*) desc limit 10) x),
    'error_list', (select coalesce(jsonb_agg(s), '[]') from (select jsonb_build_object('at', pe.created_at, 'provider', pe.provider, 'message', left(pe.message, 160)) s from public.playback_errors pe where pe.created_at >= _from and pe.created_at < _to order by pe.created_at desc limit 20) x),
    'events', (select coalesce(jsonb_object_agg(event, n), '{}') from (select event, count(*) n from e group by event) x)
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard(timestamptz, timestamptz) TO authenticated;

-- Per-title viewing analytics including episodes and drop-off (staff only).
CREATE OR REPLACE FUNCTION public.analytics_title(_title uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH e AS (select * from public.analytics_events where title_id = _title and occurred_at >= _from and occurred_at < _to)
  SELECT jsonb_build_object(
    'views', (select count(*) from e where event = 'play_start'),
    'unique', (select count(distinct visitor) from e where event = 'play_start'),
    'watch_seconds', (select coalesce(sum(value), 0) from e where event = 'watch_time'),
    'completions', (select count(*) from e where event = 'complete'),
    'errors', (select count(*) from e where event = 'playback_error'),
    'episodes', (select coalesce(jsonb_agg(x order by (x->>'season')::int, (x->>'number')::int), '[]') from (
      select jsonb_build_object('episode_id', ep.id, 'season', s.number, 'number', ep.number, 'title', ep.title,
        'views', count(*) filter (where e.event = 'play_start'), 'unique', count(distinct e.visitor) filter (where e.event = 'play_start'),
        'completions', count(*) filter (where e.event = 'complete')) x
      from public.episodes ep join public.seasons s on s.id = ep.season_id
      left join e on e.episode_id = ep.id
      where s.title_id = _title group by ep.id, s.number, ep.number, ep.title) y)
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.analytics_title(uuid, timestamptz, timestamptz) TO authenticated;

-- Only one featured Ramadan season at a time.
UPDATE public.ramadan_seasons SET is_featured = false WHERE is_featured AND id <> (select id from public.ramadan_seasons where is_featured order by year desc limit 1);
CREATE UNIQUE INDEX IF NOT EXISTS ramadan_one_featured ON public.ramadan_seasons ((true)) WHERE is_featured;

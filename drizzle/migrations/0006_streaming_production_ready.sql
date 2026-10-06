CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.user_roles where user_id = _user_id
    and (role = _role or (role::text = 'super_admin' and _role::text in ('admin','editor','content_manager','support'))))
$$;

CREATE TABLE public.admin_permissions (
  user_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('media','subtitles','catalog','users')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own permissions" ON public.admin_permissions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role::text in ('super_admin','admin','content_manager','editor','support'))
$$;
CREATE OR REPLACE FUNCTION public.can_manage_media(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role::text in ('super_admin','admin'))
      or exists(select 1 from public.admin_permissions where user_id = _user_id and permission = 'media')
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid), public.can_manage_media(uuid) TO authenticated;

ALTER TABLE public.video_sources
  ADD COLUMN IF NOT EXISTS is_test_source boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_language text;
UPDATE public.video_sources SET is_test_source = true
  WHERE provider = 'demo-open-license' OR url ILIKE '%test-streams.mux.dev%';

DROP POLICY IF EXISTS "admin manage sources" ON public.video_sources;
CREATE POLICY "media managers manage sources" ON public.video_sources FOR ALL TO authenticated
  USING (public.can_manage_media(auth.uid())) WITH CHECK (public.can_manage_media(auth.uid()));
DROP POLICY IF EXISTS "admin read audit" ON public.video_source_audit;
CREATE POLICY "media managers read audit" ON public.video_source_audit FOR SELECT TO authenticated USING (public.can_manage_media(auth.uid()));
ALTER TABLE public.playback_errors
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS device text;
DROP POLICY IF EXISTS "admin read playback errors" ON public.playback_errors;
CREATE POLICY "media managers read playback errors" ON public.playback_errors FOR SELECT TO authenticated USING (public.can_manage_media(auth.uid()));

ALTER TABLE public.subtitle_tracks ALTER COLUMN video_source_id DROP NOT NULL;
ALTER TABLE public.subtitle_tracks
  ADD COLUMN IF NOT EXISTS title_id uuid REFERENCES public.titles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_forced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sdh boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vtt text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.subtitle_tracks st SET title_id = vs.title_id, episode_id = vs.episode_id FROM public.video_sources vs WHERE st.video_source_id = vs.id AND st.title_id IS NULL;
CREATE INDEX IF NOT EXISTS subtitle_tracks_unit_idx ON public.subtitle_tracks(title_id, episode_id);
DROP POLICY IF EXISTS "admin manage subs" ON public.subtitle_tracks;
CREATE POLICY "media managers manage subs" ON public.subtitle_tracks FOR ALL TO authenticated
  USING (public.can_manage_media(auth.uid())) WITH CHECK (public.can_manage_media(auth.uid()));

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS recap_start_s integer,
  ADD COLUMN IF NOT EXISTS credits_start_s integer;
ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS intro_start_s integer,
  ADD COLUMN IF NOT EXISTS intro_end_s integer,
  ADD COLUMN IF NOT EXISTS credits_start_s integer;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autoplay_next boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS audio_lang text;
ALTER TABLE public.playback_progress
  ADD COLUMN IF NOT EXISTS last_watched_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS percentage numeric GENERATED ALWAYS AS (CASE WHEN duration_s > 0 THEN round(position_s::numeric * 100 / duration_s, 2) ELSE 0 END) STORED;

DROP FUNCTION IF EXISTS public.playback_candidates(uuid, uuid, text);
CREATE FUNCTION public.playback_candidates(_title uuid, _episode uuid DEFAULT NULL, _country text DEFAULT NULL, _include_test boolean DEFAULT false)
RETURNS TABLE(id uuid, provider text, kind text, url text, playback_id text, provider_asset_id text, requires_signed_token boolean,
  language text, audio_language text, quality text, is_dubbed boolean, is_test_source boolean, subtitles jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select vs.id, vs.provider, vs.kind, vs.url, vs.playback_id, vs.provider_asset_id, vs.requires_signed_token,
    vs.language, vs.audio_language, vs.quality, vs.is_dubbed, vs.is_test_source,
    coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'lang', st.lang, 'label', st.label, 'url', st.url, 'forced', st.is_forced, 'sdh', st.is_sdh, 'default', st.is_default) order by st.is_default desc, st.lang)
      from public.subtitle_tracks st
      where st.is_active and (st.video_source_id = vs.id
        or (st.video_source_id is null and st.title_id = vs.title_id and st.episode_id is not distinct from _episode))), '[]'::jsonb)
  from public.video_sources vs
  join public.titles t on t.id = vs.title_id and t.published and t.deleted_at is null
  where vs.title_id = _title and vs.is_active and vs.status = 'ready'
    and (_include_test or not vs.is_test_source)
    and (vs.episode_id = _episode or vs.episode_id is null)
    and (vs.available_from is null or vs.available_from <= now())
    and (vs.available_until is null or vs.available_until > now())
    and (vs.availability_country is null or _country is null or _country = any(vs.availability_country))
  order by vs.is_test_source asc, (vs.episode_id is null) asc, vs.is_default desc, vs.priority desc, vs.created_at asc
  limit 10
$$;
REVOKE EXECUTE ON FUNCTION public.playback_candidates(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.playback_candidates(uuid, uuid, text, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.playable_units(uuid);
CREATE FUNCTION public.playable_units(_title uuid, _include_test boolean DEFAULT false)
RETURNS TABLE(episode_id uuid, test_only boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select vs.episode_id, bool_and(vs.is_test_source) from public.video_sources vs
  join public.titles t on t.id = vs.title_id and t.published and t.deleted_at is null
  where vs.title_id = _title and vs.is_active and vs.status = 'ready'
    and ((_include_test and public.can_manage_media(auth.uid())) or not vs.is_test_source)
    and (vs.available_from is null or vs.available_from <= now())
    and (vs.available_until is null or vs.available_until > now())
  group by vs.episode_id
$$;
GRANT EXECUTE ON FUNCTION public.playable_units(uuid, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.subtitle_vtt(_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select vtt from public.subtitle_tracks where id = _id and is_active
$$;
GRANT EXECUTE ON FUNCTION public.subtitle_vtt(uuid) TO anon, authenticated;
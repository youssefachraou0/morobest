ALTER TABLE public.video_sources
  ADD COLUMN IF NOT EXISTS provider_asset_id text,
  ADD COLUMN IF NOT EXISTS playback_id text,
  ADD COLUMN IF NOT EXISTS upload_id text,
  ADD COLUMN IF NOT EXISTS quality text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS is_dubbed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_subbed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_signed_token boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability_country text[],
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.video_sources ADD CONSTRAINT video_sources_status_chk CHECK (status IN ('uploading','processing','ready','failed','disabled'));
ALTER TABLE public.video_sources ADD CONSTRAINT video_sources_kind_chk CHECK (kind IN ('hls','dash','mp4','embed'));
COMMENT ON COLUMN public.video_sources.kind IS 'source_type: hls | dash | mp4 | embed';
CREATE INDEX IF NOT EXISTS video_sources_title_idx ON public.video_sources(title_id, episode_id);
CREATE TRIGGER video_sources_touch BEFORE UPDATE ON public.video_sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.video_source_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid,
  actor uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_source_audit TO authenticated;
GRANT ALL ON public.video_source_audit TO service_role;
ALTER TABLE public.video_source_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.video_source_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.playback_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.video_sources(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.playback_errors TO authenticated;
GRANT ALL ON public.playback_errors TO service_role;
ALTER TABLE public.playback_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read playback errors" ON public.playback_errors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.audit_video_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.video_source_audit(source_id, actor, action, details)
  VALUES (coalesce(new.id, old.id), auth.uid(), lower(TG_OP),
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('provider', old.provider, 'kind', old.kind)
         ELSE jsonb_build_object('provider', new.provider, 'kind', new.kind, 'status', new.status, 'is_active', new.is_active, 'is_default', new.is_default) END);
  RETURN coalesce(new, old);
END $$;
CREATE TRIGGER video_sources_audit AFTER INSERT OR UPDATE OR DELETE ON public.video_sources FOR EACH ROW EXECUTE FUNCTION public.audit_video_source();

-- Candidate sources for playback, best first. Server-only (service_role).
CREATE OR REPLACE FUNCTION public.playback_candidates(_title uuid, _episode uuid DEFAULT NULL, _country text DEFAULT NULL)
RETURNS TABLE(id uuid, provider text, kind text, url text, playback_id text, provider_asset_id text, requires_signed_token boolean, language text, quality text, is_dubbed boolean, subtitles jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select vs.id, vs.provider, vs.kind, vs.url, vs.playback_id, vs.provider_asset_id, vs.requires_signed_token, vs.language, vs.quality, vs.is_dubbed,
    coalesce((select jsonb_agg(jsonb_build_object('lang', st.lang, 'label', st.label, 'url', st.url)) from public.subtitle_tracks st where st.video_source_id = vs.id), '[]'::jsonb)
  from public.video_sources vs
  join public.titles t on t.id = vs.title_id and t.published and t.deleted_at is null
  where vs.title_id = _title and vs.is_active and vs.status = 'ready'
    and (vs.episode_id = _episode or vs.episode_id is null)
    and (vs.available_from is null or vs.available_from <= now())
    and (vs.available_until is null or vs.available_until > now())
    and (vs.availability_country is null or _country is null or _country = any(vs.availability_country))
  order by (vs.episode_id is null) asc, vs.is_default desc, vs.priority desc, vs.created_at asc
  limit 10
$$;
REVOKE EXECUTE ON FUNCTION public.playback_candidates(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.playback_candidates(uuid, uuid, text) TO service_role;

-- Public availability flags (no URLs): which title/episodes are watchable.
CREATE OR REPLACE FUNCTION public.playable_units(_title uuid)
RETURNS TABLE(episode_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select distinct vs.episode_id from public.video_sources vs
  join public.titles t on t.id = vs.title_id and t.published and t.deleted_at is null
  where vs.title_id = _title and vs.is_active and vs.status = 'ready'
    and (vs.available_from is null or vs.available_from <= now())
    and (vs.available_until is null or vs.available_until > now())
$$;
GRANT EXECUTE ON FUNCTION public.playable_units(uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_playback_source(uuid, uuid) FROM PUBLIC, anon, authenticated;
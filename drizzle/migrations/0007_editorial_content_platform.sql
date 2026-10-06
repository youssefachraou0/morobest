ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_status text NOT NULL DEFAULT 'published';
-- Backfill: every pre-existing title is a first-version fictional placeholder.
UPDATE public.titles SET is_demo = true;
ALTER TABLE public.titles ADD CONSTRAINT titles_content_status_chk CHECK (content_status IN ('draft','published','hidden','archived'));

CREATE OR REPLACE FUNCTION public.can_manage_content(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role::text in ('super_admin','admin','content_manager','editor'))
      or exists(select 1 from public.admin_permissions where user_id = _user_id and permission = 'content')
$$;
CREATE OR REPLACE FUNCTION public.title_is_public(_title uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.titles where id = _title and published and deleted_at is null and not is_demo and content_status = 'published')
$$;
CREATE OR REPLACE FUNCTION public.public_playable_units(_title uuid)
RETURNS TABLE(episode_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select u.episode_id from public.playable_units(_title, false) u where public.title_is_public(_title)
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_content(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.title_is_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_playable_units(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "public read titles" ON public.titles;
CREATE POLICY "public read live titles" ON public.titles FOR SELECT TO anon, authenticated
  USING (published AND deleted_at IS NULL AND NOT is_demo AND content_status = 'published');
CREATE POLICY "staff read all titles" ON public.titles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "content managers write titles" ON public.titles FOR ALL TO authenticated
  USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "content managers write translations" ON public.title_translations FOR ALL TO authenticated
  USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "content managers write seasons" ON public.seasons FOR ALL TO authenticated
  USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "content managers write episodes" ON public.episodes FOR ALL TO authenticated
  USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));

CREATE TABLE public.content_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('tmdb','anilist')),
  provider_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('movie','series','episode','anime','manga')),
  is_primary boolean NOT NULL DEFAULT true,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid
);
CREATE UNIQUE INDEX content_links_ext_primary ON public.content_links(provider, content_type, provider_id) WHERE is_primary;
CREATE UNIQUE INDEX content_links_title_primary ON public.content_links(title_id, provider) WHERE is_primary;
CREATE UNIQUE INDEX content_links_pair ON public.content_links(provider, content_type, provider_id, title_id);
INSERT INTO public.content_links(title_id, provider, provider_id, content_type)
  SELECT DISTINCT ON (title_id) title_id, 'tmdb', provider_id, CASE media_type WHEN 'tv' THEN 'series' ELSE 'movie' END
  FROM public.external_titles WHERE title_id IS NOT NULL ON CONFLICT DO NOTHING;
COMMENT ON COLUMN public.external_titles.title_id IS 'DEPRECATED: replaced by content_links';
COMMENT ON COLUMN public.external_titles.custom_translations IS 'DEPRECATED: replaced by content_overrides';

CREATE TABLE public.episode_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_id text NOT NULL,
  season_number int NOT NULL,
  episode_number int NOT NULL,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  is_manual boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id, season_number, episode_number)
);

CREATE TABLE public.content_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, content_type text NOT NULL, provider_id text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','fr','ar')),
  title text, subtitle text, tagline text, overview text, short_description text,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, content_type, provider_id, locale)
);

CREATE TABLE public.seo_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, content_type text NOT NULL, provider_id text NOT NULL,
  slug text CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  canonical_url text, indexable boolean NOT NULL DEFAULT true, follow_links boolean NOT NULL DEFAULT true,
  seo_title_ar text, seo_title_fr text, seo_title_en text,
  meta_description_ar text, meta_description_fr text, meta_description_en text,
  og_title text, og_description text, og_image text, schema jsonb,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, content_type, provider_id)
);
CREATE UNIQUE INDEX seo_overrides_slug ON public.seo_overrides(content_type, slug) WHERE slug IS NOT NULL;

CREATE TABLE public.slug_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL, old_slug text NOT NULL, provider text NOT NULL, provider_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_type, old_slug)
);

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL, action text NOT NULL, content_id text,
  old_value jsonb, new_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_content ON public.admin_audit_log(content_id, created_at DESC);

ALTER TABLE public.ramadan_seasons
  ADD COLUMN IF NOT EXISTS name_ar text, ADD COLUMN IF NOT EXISTS name_fr text, ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS hero_image text, ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.ramadan_titles
  ADD COLUMN IF NOT EXISTS title_id uuid REFERENCES public.titles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_schedule text, ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'airing' CHECK (status IN ('upcoming','airing','completed'));
CREATE POLICY "content managers manage ramadan titles" ON public.ramadan_titles FOR ALL TO authenticated
  USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "content managers manage ramadan seasons" ON public.ramadan_seasons FOR ALL TO authenticated
  USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));

GRANT SELECT ON public.content_links, public.episode_links, public.content_overrides, public.seo_overrides, public.slug_redirects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_links, public.episode_links, public.content_overrides, public.seo_overrides, public.slug_redirects TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.content_links, public.episode_links, public.content_overrides, public.seo_overrides, public.slug_redirects, public.admin_audit_log TO service_role;

ALTER TABLE public.content_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read links" ON public.content_links FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "manage links" ON public.content_links FOR ALL TO authenticated USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "read episode links" ON public.episode_links FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "manage episode links" ON public.episode_links FOR ALL TO authenticated USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "read overrides" ON public.content_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "manage overrides" ON public.content_overrides FOR ALL TO authenticated USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "read seo" ON public.seo_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "manage seo" ON public.seo_overrides FOR ALL TO authenticated USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "read redirects" ON public.slug_redirects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "manage redirects" ON public.slug_redirects FOR ALL TO authenticated USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "staff read audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "managers write own audit" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid() AND (public.can_manage_content(auth.uid()) OR public.can_manage_media(auth.uid())));
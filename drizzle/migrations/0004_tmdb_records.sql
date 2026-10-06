CREATE TABLE public.external_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'tmdb',
  provider_id text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  title_id uuid REFERENCES public.titles(id) ON DELETE SET NULL,
  custom_translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, media_type, provider_id)
);
GRANT SELECT ON public.external_titles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.external_titles TO authenticated;
GRANT ALL ON public.external_titles TO service_role;
ALTER TABLE public.external_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external titles readable" ON public.external_titles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage external titles" ON public.external_titles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ramadan_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.ramadan_seasons(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'tmdb',
  provider_id text NOT NULL,
  media_type text NOT NULL DEFAULT 'tv' CHECK (media_type IN ('movie','tv')),
  country_code text REFERENCES public.countries(code) ON DELETE SET NULL,
  air_time text,
  ord int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, provider, media_type, provider_id)
);
GRANT SELECT ON public.ramadan_titles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ramadan_titles TO authenticated;
GRANT ALL ON public.ramadan_titles TO service_role;
ALTER TABLE public.ramadan_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ramadan titles readable" ON public.ramadan_titles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage ramadan titles" ON public.ramadan_titles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
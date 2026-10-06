CREATE TABLE public.provider_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.provider_cache TO service_role;
ALTER TABLE public.provider_cache ENABLE ROW LEVEL SECURITY;
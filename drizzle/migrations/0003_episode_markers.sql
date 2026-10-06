ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS intro_start_s integer,
  ADD COLUMN IF NOT EXISTS intro_end_s integer,
  ADD COLUMN IF NOT EXISTS recap_end_s integer;
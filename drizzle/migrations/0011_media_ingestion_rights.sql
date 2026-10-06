ALTER TABLE public.video_sources
  ADD COLUMN IF NOT EXISTS rights_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS rights_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS duration_s numeric,
  ADD COLUMN IF NOT EXISTS replaces_source_ids uuid[];
COMMENT ON COLUMN public.video_sources.rights_confirmed_by IS 'Admin who confirmed MOROBEST is authorized to distribute this video';
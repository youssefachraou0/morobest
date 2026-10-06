CREATE OR REPLACE FUNCTION public.analytics_ctx(_from timestamptz, _to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT coalesce(jsonb_object_agg(k, n), '{}') INTO r FROM (
    SELECT event || ':' || coalesce(ctx, 'none') k, count(*) n FROM public.analytics_events
    WHERE occurred_at >= _from AND occurred_at < _to AND event IN ('impression','click','search_click') GROUP BY 1) x;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.analytics_ctx(timestamptz, timestamptz) TO authenticated;
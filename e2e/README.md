# Browser end-to-end checks (Playwright, Python)

Run against the dev server (http://localhost:8080) with a staff session in
`LOVABLE_BROWSER_SUPABASE_STORAGE_KEY` / `LOVABLE_BROWSER_SUPABASE_SESSION_JSON`.
All flows open the app with `?mb_qa=1`, so every event is stored as **test traffic**
(excluded from Trending, rollups and default dashboard totals) and can be removed
with Admin → Analytics → "Delete test traffic".

- `analytics_playback_session.py` – title → Watch → broken source + fallback → 90 s playback → pause/resume → seek → finish → search.
- `analytics_series_library.py` – search click, watchlist/favorite add+remove, episode refresh dedup, autoplay to next episode.
- `admin_analytics_dashboard.py` – Today / 7 days / 30 days / Custom, NaN/undefined scan, test-traffic toggle, desktop + mobile.

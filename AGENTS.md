<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## MOROBEST architecture
- Public catalog reads go through `src/features/catalog/catalog.functions.ts` server functions using a publishable-key client (`catalog.server.ts`); why: SSR-safe, RLS-enforced, one reusable query layer.
- User data (profiles, watchlist, favorites, progress) is read/written from the browser client with RLS scoped via `owns_profile()`; why: no server round-trip needed and policies are the security boundary.
- Playback goes through `authorizePlayback` (`src/features/streaming/`): the server reads `playback_candidates` (service-role only), checks profile/age/region/rights window, and resolves each source through a `StreamingProvider` (Mux, Cloudflare Stream, authorized URL/embed) into short-lived URLs; why: private URLs never reach the client and providers swap without frontend changes.
- All UI text lives in `src/i18n/dictionary.ts` (en/fr/ar); locale comes from the `mb_locale` cookie and sets `dir` on `<html>`; why: instant switching with correct SSR direction.
- Reusable UI primitives live in `src/components/mb/*`; pages compose them rather than duplicating cards/rows.
- AniList anime/manga metadata goes through `src/features/anilist/` (server-only provider with throttle, retry, memory + `provider_cache` table cache, stale fallback, normalized models); why: the UI never sees raw GraphQL and AniList outages don't break pages.
- AniList detail URLs are `/anime|manga/<romaji-slug>-<anilistId>`; why: the trailing id gives stable, collision-free lookups without importing the catalog.
- TMDB movie/TV metadata goes through `src/features/tmdb/` (server-only provider with Bearer auth, retry, memory + `provider_cache` cache, stale fallback, normalized models); detail URLs are `/movie|tv|person/<slug>-<tmdbId>`; MOROBEST stores only links/overrides in `external_titles` and Ramadan picks in `ramadan_titles`; why: secrets stay server-side and TMDB stays metadata-only, separate from streaming.
- Editorial data (content_links, episode_links, content_overrides, seo_overrides, slug_redirects, ramadan_titles) is keyed by provider + content_type + provider_id and lives in `src/features/editorial/`; why: provider syncs only clear provider caches, so MOROBEST edits are never overwritten.
- Public visibility of MOROBEST titles is enforced by the titles RLS policy (published, not deleted, not is_demo, content_status='published'); why: every public query excludes demo/hidden titles automatically.
- Admin content actions run through `admin.functions.ts` with requireSupabaseAuth plus a `can_manage_content` check and write to `admin_audit_log`; why: the UI is never the security boundary.
- Analytics events are validated by the strict schema in `src/features/analytics/schema.ts` and metric definitions live in `metrics.ts` mirrored by the SQL dashboard functions; staff/QA/test-video/automated traffic is stored with `is_test` and excluded from trending, rollups and default totals; why: one tested definition of views/watch time/completion/failure and no internal traffic in public stats.
- AI recommendations (`src/features/recommend/`) ask the Lovable AI Gateway for structured title picks, then resolve each through the TMDB/AniList providers so only real catalog pages with canonical URLs are shown; why: the model never invents links and the key stays server-side.
- Video ingestion (Admin Media → Import / Upload, `MediaIngest.tsx`) only creates Mux direct uploads with a stored rights confirmation and an explicit Replace/Alternate choice when a production source exists; the Mux webhook/sync activates the source when ready and retires replaced ones; why: no manual asset IDs and test videos can never stand in for commercial titles.
- Diagnostic titles (`titles.is_diagnostic`) stay reachable by direct URL but are excluded from catalog lists and trending, and their analytics are forced to `is_test` by a DB trigger; why: a legal streaming test title must never leak into rankings or editorial surfaces.
- The player never waits indefinitely: a 15s startup watchdog, a 25s stall watchdog and an H.264/MSE capability check turn into a user-safe error plus a `playback_errors` row (browser/OS family only); why: undecodable or stuck streams must fail visibly and be diagnosable.

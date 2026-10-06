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

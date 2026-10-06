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
- Video source URLs are never selectable by clients; they are resolved only through the `get_playback_source` security-definer function; why: keeps provider URLs out of page markup and lets new providers plug in.
- All UI text lives in `src/i18n/dictionary.ts` (en/fr/ar); locale comes from the `mb_locale` cookie and sets `dir` on `<html>`; why: instant switching with correct SSR direction.
- Reusable UI primitives live in `src/components/mb/*`; pages compose them rather than duplicating cards/rows.

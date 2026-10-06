# MOROBEST — Phase 1 Foundation

Building the real foundation from the brief in stages, starting with the 20 Phase 1 items. The visual direction comes straight from the brief: dark cinematic look, antique gold, eight-point star, Arabic/French/English.

## Stage A — Brand and app shell (first build)
- Design system: near-black / midnight / deep Moroccan green surfaces, antique gold + copper accents, restrained red, ivory text. Fonts: Cormorant-style display serif for headings, a clean sans for body, and an Arabic pair (e.g. Noto Kufi Arabic / IBM Plex Sans Arabic).
- Subtle zellige/star geometry used only for separators, loaders, badges and empty states.
- MOROBEST logo: modern eight-point star with a play-shaped negative space. Used for the logo, favicon, loader and watermark.
- Language system (AR / FR / EN) with full right-to-left for Arabic. Switching languages happens instantly, without a page reload.
- Global navigation: desktop top bar with the content worlds, mobile bottom bar (Home, Explore, Search, Watchlist, Profile).
- Reusable UI: hero, carousel row, poster card, landscape card, episode card, person card, manga card, skeletons, empty and error states (404, 500, unavailable, empty search).

## Stage B — Lovable Cloud and database
- Enable Lovable Cloud.
- Normalized schema with UUID keys, foreign keys, indexes and timestamps:
  - titles (one table for all kinds: movie, series, anime, manga, plus localized translations)
  - seasons, episodes
  - manga volumes and chapters
  - genres, countries, languages, studios, people, credits
  - collections, Ramadan seasons, homepage sections
  - media assets, video sources, subtitle tracks, availability
  - profiles (several per account, kids flag, age limit), user roles
  - watchlist, favorites, ratings, playback progress, watch history
- Row-level security rules: everyone can read the catalog, users can only touch their own data, and only admins can edit the catalog (checked through a separate roles table).
- A starter catalog of a few dozen titles across all worlds, so every page shows real data.

## Stage C — Pages
- Home: hero, Continue Watching, Trending, Top 10, Arabic, Moroccan, Ramadan, Anime, Kids and Collections rows, all driven by the database.
- World pages: Movies, Series, Arabic (with /arabic/:country), Ramadan (/ramadan/:year), Anime, Manga, Kids, Classics, New, Trending, Collections. Each has filters.
- Title page for movies, series and anime, with seasons, episodes and related titles.
- Manga page with volumes and chapters (catalog only, no reading).
- Player page that works with legal sources only: HLS/MP4 playback, subtitles, speed, resume, next episode and keyboard shortcuts. Sources are loaded from the server and never written into the page.
- Search with filters.
- Sign-in, sign-up and password reset; profile picker; Kids profiles hide content above their age limit.
- Watchlist and watch progress.
- Admin shell (admins only): dashboard counts plus simple management of titles.
- Each page gets its own title and description for search engines.

## Later phases (not in this pass)
AI recommendations, external metadata imports (TMDB etc.), analytics dashboards, monetization, bot protection, full admin tools for every entity.

## Technical notes
- TanStack Start file routes; data read through route loaders and React Query; server functions for privileged work.
- `src/i18n` dictionary + context, `dir` set on the `<html>` element.
- Feature folders: `src/features/{catalog,player,auth,profiles,admin}` hold the services and hooks; `src/components/mb/*` holds the UI primitives.
- Content imagery is generated artwork until a real metadata provider is connected.

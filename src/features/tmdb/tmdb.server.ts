// TMDBProvider — server-only metadata provider. Bearer auth, retry, two-level cache, normalization.
// TMDB supplies metadata only; playback stays in src/features/streaming.
import type {
  TmdbCard, TmdbCountryPage, TmdbDetail, TmdbEpisode, TmdbLocale, TmdbPage, TmdbPerson, TmdbPersonCard,
  TmdbRow, TmdbSearch, TmdbSeason, TmdbType, TmdbWorld,
} from "./types";

const BASE = "https://api.themoviedb.org/3";
export const TTL = { trending: 20 * 60, popular: 3 * 3600, detail: 8 * 3600, search: 30 * 60, stable: 24 * 3600, person: 24 * 3600 };
export const LANG: Record<TmdbLocale, string> = { en: "en-US", fr: "fr-FR", ar: "ar" };

const mem = new Map<string, { exp: number; v: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export class TmdbError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

async function adminDb() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export async function tmdb<T = Raw>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T | null> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new TmdbError(401, "TMDB is not configured");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (e) {
      if (attempt++ < 2) { await new Promise((r) => setTimeout(r, 500 * attempt)); continue; }
      throw new TmdbError(0, `TMDB network failure: ${(e as Error).message}`);
    }
    if (res.status === 404) return null;
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const ra = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(ra, 5) * 1000));
      attempt++;
      continue;
    }
    if (!res.ok) throw new TmdbError(res.status, `TMDB ${res.status} on ${path}`);
    return (await res.json()) as T;
  }
}

/** Cache-first: memory → provider_cache table → TMDB; on failure serves stale data. */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const m = mem.get(key);
  if (m && m.exp > now) return m.v as T;
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    const db = await adminDb();
    let stale: T | undefined = m?.v as T | undefined;
    if (db) {
      const { data } = await db.from("provider_cache").select("payload, expires_at").eq("key", key).maybeSingle();
      if (data) {
        const exp = new Date(data.expires_at).getTime();
        if (exp > now) { mem.set(key, { exp, v: data.payload }); return data.payload as T; }
        stale = data.payload as T;
      }
    }
    try {
      const v = await load();
      const exp = now + ttlSec * 1000;
      mem.set(key, { exp, v });
      if (mem.size > 500) mem.delete(mem.keys().next().value!);
      if (db) await db.from("provider_cache").upsert({ key, payload: v as never, expires_at: new Date(exp).toISOString(), updated_at: new Date().toISOString() });
      return v;
    } catch (e) {
      console.error("TMDB fetch failed", key, e instanceof TmdbError ? e.status : "", (e as Error).message);
      if (stale !== undefined) return stale;
      throw new Error("Movie catalog temporarily unavailable");
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// ---------- Normalization ----------
export function slugify(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
const mkSlug = (name: string, alt: string, id: number) => `${slugify(name) || slugify(alt) || "title"}-${id}`;

export function toCard(r: Raw, forced?: TmdbType): TmdbCard {
  const type: TmdbType = forced ?? (r.media_type === "tv" || r.first_air_date !== undefined || r.name !== undefined ? "tv" : "movie");
  const title = (type === "tv" ? r.name : r.title) || r.original_name || r.original_title || "Untitled";
  const originalTitle = (type === "tv" ? r.original_name : r.original_title) || title;
  const date = (type === "tv" ? r.first_air_date : r.release_date) || null;
  return {
    tmdbId: r.id, type, slug: mkSlug(originalTitle, title, r.id), title, originalTitle,
    poster: r.poster_path ?? null, backdrop: r.backdrop_path ?? null,
    year: date ? Number(date.slice(0, 4)) : null, date,
    rating: r.vote_count > 0 && r.vote_average != null ? Math.round(r.vote_average * 10) / 10 : null,
    votes: r.vote_count ?? 0, popularity: r.popularity ?? 0,
    overview: r.overview ? String(r.overview).slice(0, 400) : null, language: r.original_language ?? null,
  };
}
const person = (p: Raw, role: string | null = null): TmdbPersonCard => ({
  id: p.id, slug: mkSlug(p.name ?? "", "person", p.id), name: p.name ?? "", photo: p.profile_path ?? null, role,
  knownFor: p.known_for_department ?? null,
});
const dedupe = <T extends { tmdbId: number; type: string }>(xs: T[]) => {
  const seen = new Set<string>();
  return xs.filter((x) => { const k = x.type + x.tmdbId; if (seen.has(k)) return false; seen.add(k); return true; });
};
const cards = (r: Raw, type?: TmdbType) => dedupe(((r?.results ?? []) as Raw[]).filter((x) => !x.adult && (x.media_type ? x.media_type !== "person" : true)).map((x) => toCard(x, type)));

// ---------- Lists ----------
export type Discover = {
  type: TmdbType; page?: number; sort?: string; genres?: string; country?: string; language?: string;
  dateGte?: string; dateLte?: string; minVotes?: number; certLte?: string;
};
export async function discover(d: Discover, lang: string): Promise<TmdbPage> {
  const dateKey = d.type === "movie" ? "primary_release_date" : "first_air_date";
  const r = await tmdb(`/discover/${d.type}`, {
    language: lang, page: d.page ?? 1, include_adult: false, sort_by: d.sort ?? "popularity.desc",
    with_genres: d.genres, with_origin_country: d.country, with_original_language: d.language,
    [`${dateKey}.gte`]: d.dateGte, [`${dateKey}.lte`]: d.dateLte ?? (d.sort?.startsWith(dateKey) ? today() : undefined),
    "vote_count.gte": d.minVotes,
    ...(d.certLte && d.type === "movie" ? { certification_country: "US", "certification.lte": d.certLte } : {}),
  });
  return { items: cards(r, d.type), page: r?.page ?? 1, hasNext: (r?.page ?? 1) < Math.min(r?.total_pages ?? 1, 500), total: r?.total_results ?? 0 };
}
const today = () => new Date().toISOString().slice(0, 10);
const yearsAgo = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };

async function list(path: string, lang: string, type: TmdbType, extra: Record<string, string | number> = {}) {
  return cards(await tmdb(path, { language: lang, ...extra }), type);
}

const ttlFor = (key: string) => (key.includes("trending") || key.includes("now") || key.includes("airing") ? TTL.trending : key.includes("classic") ? TTL.stable : TTL.popular);
const row = (key: string, lang: string, load: () => Promise<TmdbCard[]>, seeAll?: TmdbRow["seeAll"]): Promise<TmdbRow> =>
  cached(`tmdb:row:${key}:${lang}`, ttlFor(key), load).then((items) => ({ key, items, seeAll })).catch(() => ({ key, items: [], seeAll }));

export const ARAB_CODES = ["MA", "DZ", "TN", "LY", "MR", "EG", "SD", "SA", "AE", "QA", "KW", "BH", "OM", "YE", "SY", "LB", "JO", "PS", "IQ"];
const ARAB = ARAB_CODES.join("|");
const KIDS_TV = "10762|16";

export async function world(kind: "home" | "movies" | "series" | "kids" | "arabic" | "trending" | "new" | "classics", lang: string, kidsOnly = false): Promise<TmdbWorld> {
  const disc = (d: Discover) => () => discover(d, lang).then((p) => p.items);
  let rows: Promise<TmdbRow>[];
  if (kidsOnly || kind === "kids") {
    rows = [
      row("kidsMovies", lang, disc({ type: "movie", genres: "10751", certLte: "PG", minVotes: 50 }), { type: "movie", params: { genres: "10751" } }),
      row("animatedMovies", lang, disc({ type: "movie", genres: "16", certLte: "PG", minVotes: 50 }), { type: "movie", params: { genres: "16" } }),
      row("familyMovies", lang, disc({ type: "movie", genres: "10751,12", certLte: "PG", minVotes: 50 })),
      row("kidsTv", lang, disc({ type: "tv", genres: "10762", minVotes: 10 }), { type: "tv", params: { genres: "10762" } }),
      row("animationTv", lang, disc({ type: "tv", genres: KIDS_TV, minVotes: 20, sort: "vote_average.desc" })),
    ];
  } else if (kind === "movies") {
    rows = [
      row("trendingMovies", lang, () => list("/trending/movie/week", lang, "movie")),
      row("popularMovies", lang, () => list("/movie/popular", lang, "movie")),
      row("nowPlaying", lang, () => list("/movie/now_playing", lang, "movie")),
      row("upcoming", lang, () => list("/movie/upcoming", lang, "movie")),
      row("topMovies", lang, () => list("/movie/top_rated", lang, "movie")),
      row("newMovies", lang, disc({ type: "movie", sort: "primary_release_date.desc", minVotes: 30, dateGte: yearsAgo(1) })),
      row("arabicMovies", lang, disc({ type: "movie", country: ARAB, minVotes: 5 }), { type: "movie", params: { country: ARAB } }),
      row("classicMovies", lang, disc({ type: "movie", sort: "vote_average.desc", dateLte: "1985-12-31", minVotes: 800 })),
    ];
  } else if (kind === "series") {
    rows = [
      row("trendingTv", lang, () => list("/trending/tv/week", lang, "tv")),
      row("popularTv", lang, () => list("/tv/popular", lang, "tv")),
      row("airingTv", lang, () => list("/tv/on_the_air", lang, "tv")),
      row("topTv", lang, () => list("/tv/top_rated", lang, "tv")),
      row("newTv", lang, disc({ type: "tv", sort: "first_air_date.desc", minVotes: 20, dateGte: yearsAgo(1) })),
      row("arabicTv", lang, disc({ type: "tv", country: ARAB, minVotes: 3 }), { type: "tv", params: { country: ARAB } }),
    ];
  } else if (kind === "arabic") {
    rows = [
      row("arabicMovies", lang, disc({ type: "movie", country: ARAB, minVotes: 5 })),
      row("arabicTv", lang, disc({ type: "tv", country: ARAB, minVotes: 3 })),
      row("arabicTop", lang, disc({ type: "movie", country: ARAB, sort: "vote_average.desc", minVotes: 40 })),
      row("arabicNew", lang, disc({ type: "movie", country: ARAB, sort: "primary_release_date.desc", minVotes: 2 })),
    ];
  } else if (kind === "trending") {
    rows = [
      row("trendingAll", lang, () => list("/trending/all/day", lang, undefined as never)),
      row("trendingMovies", lang, () => list("/trending/movie/week", lang, "movie")),
      row("trendingTv", lang, () => list("/trending/tv/week", lang, "tv")),
    ];
  } else if (kind === "new") {
    rows = [
      row("newMovies", lang, disc({ type: "movie", sort: "primary_release_date.desc", minVotes: 30, dateGte: yearsAgo(1) })),
      row("nowPlaying", lang, () => list("/movie/now_playing", lang, "movie")),
      row("newTv", lang, disc({ type: "tv", sort: "first_air_date.desc", minVotes: 20, dateGte: yearsAgo(1) })),
      row("upcoming", lang, () => list("/movie/upcoming", lang, "movie")),
    ];
  } else if (kind === "classics") {
    rows = [
      row("classicMovies", lang, disc({ type: "movie", sort: "vote_average.desc", dateLte: "1985-12-31", minVotes: 800 })),
      row("classicArabic", lang, disc({ type: "movie", country: ARAB, dateLte: "1995-12-31", minVotes: 5 })),
      row("classicGolden", lang, disc({ type: "movie", sort: "vote_average.desc", dateLte: "1965-12-31", minVotes: 300 })),
      row("classicTv", lang, disc({ type: "tv", sort: "vote_average.desc", dateLte: "1999-12-31", minVotes: 300 })),
    ];
  } else {
    rows = [
      row("trendingAll", lang, () => list("/trending/all/day", lang, undefined as never)),
      row("popularMovies", lang, () => list("/movie/popular", lang, "movie")),
      row("popularTv", lang, () => list("/tv/popular", lang, "tv")),
      row("moroccan", lang, disc({ type: "movie", country: "MA", minVotes: 2 })),
      row("arabicTv", lang, disc({ type: "tv", country: ARAB, minVotes: 3 })),
      row("nowPlaying", lang, () => list("/movie/now_playing", lang, "movie")),
      row("topMovies", lang, () => list("/movie/top_rated", lang, "movie")),
      row("classicMovies", lang, disc({ type: "movie", sort: "vote_average.desc", dateLte: "1985-12-31", minVotes: 800 })),
    ];
  }
  const all = await Promise.all(rows);
  const filled = all.filter((r) => r.items.length > 0);
  if (!filled.length) throw new Error("Movie catalog temporarily unavailable");
  const hero = dedupe(filled.flatMap((r) => r.items.slice(0, 4))).filter((x) => x.backdrop && x.overview).slice(0, 6);
  return { hero, rows: filled };
}

export async function countryPage(code: string, lang: string): Promise<TmdbCountryPage> {
  const disc = (d: Omit<Discover, "country">) => () => discover({ ...d, country: code }, lang).then((p) => p.items);
  const rows = await Promise.all([
    row(`c-featured-${code}`, lang, disc({ type: "movie", sort: "popularity.desc" })),
    row(`c-movies-${code}`, lang, disc({ type: "movie", sort: "vote_count.desc" }), { type: "movie", params: { country: code } }),
    row(`c-series-${code}`, lang, disc({ type: "tv", sort: "popularity.desc" }), { type: "tv", params: { country: code } }),
    row(`c-new-${code}`, lang, disc({ type: "movie", sort: "primary_release_date.desc", dateGte: yearsAgo(4) })),
    row(`c-newtv-${code}`, lang, disc({ type: "tv", sort: "first_air_date.desc", dateGte: yearsAgo(4) })),
    row(`c-top-${code}`, lang, disc({ type: "movie", sort: "vote_average.desc", minVotes: 15 })),
    row(`c-classic-${code}`, lang, disc({ type: "movie", sort: "vote_count.desc", dateLte: "1995-12-31" })),
  ]);
  const [featured, ...rest] = rows;
  const named = rest.map((r) => ({ ...r, key: r.key.replace(`-${code}`, "").replace(/^c-/, "country_") }));
  const top = [...featured.items].slice(0, 3);
  const [people, genres] = await Promise.all([
    cached(`tmdb:cpeople:${code}`, TTL.stable, async () => {
      const credits = await Promise.all(top.map((t) => tmdb(`/movie/${t.tmdbId}/credits`).catch(() => null)));
      const seen = new Set<number>();
      return credits.flatMap((c) => (c?.cast ?? []).slice(0, 8)).filter((p: Raw) => p.profile_path && !seen.has(p.id) && seen.add(p.id)).slice(0, 18).map((p: Raw) => person(p));
    }).catch(() => [] as TmdbPersonCard[]),
    genreList("movie", lang).catch(() => []),
  ]);
  const used = new Set<number>();
  for (const id of await cached(`tmdb:cgenres:${code}`, TTL.stable, async () => {
    const r = await tmdb(`/discover/movie`, { with_origin_country: code, sort_by: "popularity.desc", include_adult: false });
    return ((r?.results ?? []) as Raw[]).flatMap((x) => x.genre_ids ?? []) as number[];
  }).catch(() => [] as number[])) used.add(id);
  return {
    hero: featured.items.filter((x) => x.backdrop).slice(0, 5),
    rows: [{ ...featured, key: "country_featured" }, ...named].filter((r) => r.items.length),
    people,
    genres: genres.filter((g) => used.has(g.id)).map((g) => ({ ...g, type: "movie" as const })),
  };
}

export function genreList(type: TmdbType, lang: string) {
  return cached(`tmdb:genres:${type}:${lang}`, 7 * TTL.stable, async () => {
    const r = await tmdb(`/genre/${type}/list`, { language: lang });
    return ((r?.genres ?? []) as { id: number; name: string }[]);
  });
}

// ---------- Detail ----------
async function fillOverview(type: TmdbType, id: number, lang: string, overview: string | null) {
  if (overview || lang === "en-US") return overview;
  const en = await tmdb(`/${type}/${id}`, { language: "en-US" }).catch(() => null);
  return en?.overview || null;
}

export async function detail(type: TmdbType, id: number, lang: string): Promise<TmdbDetail | null> {
  const append = type === "movie" ? "credits,videos,images,recommendations,similar" : "aggregate_credits,credits,videos,images,recommendations,similar";
  const r = await tmdb(`/${type}/${id}`, {
    language: lang, append_to_response: append,
    include_image_language: `${lang.slice(0, 2)},en,null`, include_video_language: `${lang.slice(0, 2)},en,null`,
  });
  if (!r || r.adult) return null;
  const card = toCard(r, type);
  const crew = (r.credits?.crew ?? []) as Raw[];
  const castSrc = type === "tv" && r.aggregate_credits?.cast?.length
    ? (r.aggregate_credits.cast as Raw[]).map((c) => ({ ...c, character: c.roles?.[0]?.character }))
    : ((r.credits?.cast ?? []) as Raw[]);
  const vids = ((r.videos?.results ?? []) as Raw[]).filter((v) => v.site === "YouTube");
  const trailer = vids.find((v) => v.type === "Trailer" && v.official) ?? vids.find((v) => v.type === "Trailer") ?? vids.find((v) => v.type === "Teaser");
  const uniq = (xs: Raw[]) => { const s = new Set<number>(); return xs.filter((x) => !s.has(x.id) && s.add(x.id)); };
  return {
    ...card,
    overview: await fillOverview(type, id, lang, r.overview || null),
    tagline: r.tagline || null,
    runtime: type === "movie" ? r.runtime ?? null : r.episode_run_time?.[0] ?? null,
    genres: r.genres ?? [],
    countries: (r.production_countries ?? []).map((c: Raw) => ({ code: c.iso_3166_1, name: c.name })).concat(
      type === "tv" && !(r.production_countries ?? []).length ? (r.origin_country ?? []).map((c: string) => ({ code: c, name: c })) : [],
    ),
    spokenLanguages: (r.spoken_languages ?? []).map((l: Raw) => l.english_name || l.name).filter(Boolean),
    status: r.status ?? null,
    cast: castSrc.slice(0, 24).map((c) => person(c, c.character ?? null)),
    directors: uniq(crew.filter((c) => c.job === "Director")).map((c) => person(c, "Director")),
    writers: uniq(crew.filter((c) => c.department === "Writing")).slice(0, 6).map((c) => person(c, c.job)),
    creators: (r.created_by ?? []).map((c: Raw) => person(c, "Creator")),
    companies: (r.production_companies ?? []).slice(0, 6).map((c: Raw) => ({ id: c.id, name: c.name, logo: c.logo_path ?? null })),
    networks: (r.networks ?? []).map((c: Raw) => ({ id: c.id, name: c.name, logo: c.logo_path ?? null })),
    trailer: trailer?.key ?? null,
    images: ((r.images?.backdrops ?? []) as Raw[]).slice(0, 12).map((i) => i.file_path),
    seasons: ((r.seasons ?? []) as Raw[]).filter((s) => s.episode_count > 0).map((s) => ({
      number: s.season_number, name: s.name, episodeCount: s.episode_count, airDate: s.air_date ?? null, poster: s.poster_path ?? null,
    })),
    totalEpisodes: r.number_of_episodes ?? null,
    recommendations: cards(r.recommendations, type).slice(0, 16),
    similar: cards(r.similar, type).slice(0, 16),
    watchSlug: await linkedTitle(type, id),
  };
}

async function linkedTitle(type: TmdbType, id: number): Promise<string | null> {
  const db = await adminDb();
  if (!db) return null;
  const { data } = await db.from("external_titles").select("title_id, titles(slug, published)").eq("provider", "tmdb").eq("media_type", type).eq("provider_id", String(id)).maybeSingle();
  const t = (data as Raw)?.titles;
  return t?.published ? t.slug : null;
}

export async function season(id: number, n: number, lang: string): Promise<TmdbSeason | null> {
  const r = await tmdb(`/tv/${id}/season/${n}`, { language: lang });
  if (!r) return null;
  let en: Raw = null;
  if (lang !== "en-US" && (r.episodes ?? []).some((e: Raw) => !e.overview)) en = await tmdb(`/tv/${id}/season/${n}`, { language: "en-US" }).catch(() => null);
  return {
    number: r.season_number, name: r.name, overview: r.overview || null, airDate: r.air_date ?? null, poster: r.poster_path ?? null,
    episodeCount: (r.episodes ?? []).length,
    episodes: ((r.episodes ?? []) as Raw[]).map((e, i): TmdbEpisode => ({
      id: e.id, number: e.episode_number, title: e.name || en?.episodes?.[i]?.name || `Episode ${e.episode_number}`,
      overview: e.overview || en?.episodes?.[i]?.overview || null, still: e.still_path ?? null,
      airDate: e.air_date ?? null, runtime: e.runtime ?? null, rating: e.vote_count > 0 ? Math.round(e.vote_average * 10) / 10 : null,
    })),
  };
}

export async function personDetail(id: number, lang: string): Promise<TmdbPerson | null> {
  const r = await tmdb(`/person/${id}`, { language: lang, append_to_response: "combined_credits" });
  if (!r || r.adult) return null;
  let bio = r.biography || null;
  if (!bio && lang !== "en-US") bio = (await tmdb(`/person/${id}`, { language: "en-US" }).catch(() => null))?.biography || null;
  const cast = ((r.combined_credits?.cast ?? []) as Raw[]).filter((c) => !c.adult);
  const crew = ((r.combined_credits?.crew ?? []) as Raw[]).filter((c) => !c.adult);
  const credits = [...cast.map((c) => ({ c, role: c.character || null })), ...crew.map((c) => ({ c, role: c.job || null }))];
  const byType = (t: TmdbType) => {
    const seen = new Set<number>();
    return credits.filter(({ c }) => c.media_type === t && !seen.has(c.id) && seen.add(c.id))
      .map(({ c, role }) => ({ ...toCard(c, t), role }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  };
  const movies = byType("movie");
  const tv = byType("tv");
  return {
    id: r.id, slug: mkSlug(r.name, "person", r.id), name: r.name, photo: r.profile_path ?? null, biography: bio,
    birthday: r.birthday ?? null, placeOfBirth: r.place_of_birth ?? null, department: r.known_for_department ?? null,
    knownFor: [...movies, ...tv].sort((a, b) => b.votes - a.votes).slice(0, 16),
    movies, tv,
  };
}

export async function search(q: string, lang: string): Promise<TmdbSearch> {
  const [a, b] = await Promise.all([
    tmdb(`/search/multi`, { query: q, language: lang, include_adult: false }),
    lang === "en-US" ? Promise.resolve(null) : tmdb(`/search/multi`, { query: q, language: "en-US", include_adult: false }).catch(() => null),
  ]);
  const results = [...((a?.results ?? []) as Raw[]), ...((b?.results ?? []) as Raw[])].filter((x) => !x.adult);
  const seen = new Set<string>();
  const uniq = results.filter((x) => { const k = x.media_type + x.id; if (seen.has(k)) return false; seen.add(k); return true; });
  return {
    movies: uniq.filter((x) => x.media_type === "movie").map((x) => toCard(x, "movie")),
    tv: uniq.filter((x) => x.media_type === "tv").map((x) => toCard(x, "tv")),
    people: uniq.filter((x) => x.media_type === "person").map((x) => person(x)),
  };
}

export async function cardsFor(refs: { type: TmdbType; id: number }[], lang: string): Promise<TmdbCard[]> {
  const out = await Promise.all(refs.map((r) =>
    cached(`tmdb:card:${r.type}:${r.id}:${lang}`, TTL.detail, async () => {
      const d = await tmdb(`/${r.type}/${r.id}`, { language: lang });
      return d ? toCard(d, r.type) : null;
    }).catch(() => null),
  ));
  return out.filter((x): x is TmdbCard => !!x);
}

/** Drops in-memory and stored cache entries whose key starts with any prefix (admin Refresh actions). */
export async function forget(prefixes: string[]) {
  for (const k of [...mem.keys()]) if (prefixes.some((p) => k.startsWith(p))) mem.delete(k);
  const db = await adminDb();
  if (db) for (const p of prefixes) await db.from("provider_cache").delete().like("key", `${p}%`);
}

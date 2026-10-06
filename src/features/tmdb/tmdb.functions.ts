import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { TmdbCard, TmdbCountryPage, TmdbDetail, TmdbLocale, TmdbPage, TmdbPerson, TmdbSearch, TmdbSeason, TmdbWorld } from "./types";

const locale = z.enum(["en", "fr", "ar"]).default("en");
const type = z.enum(["movie", "tv"]);
const worldKind = z.enum(["home", "movies", "series", "kids", "arabic", "trending", "new", "classics"]);
export type WorldKind = z.infer<typeof worldKind>;

export const fetchTmdbWorld = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: WorldKind; locale: TmdbLocale; kids?: boolean }) =>
    z.object({ kind: worldKind, locale, kids: z.boolean().optional() }).parse(d))
  .handler(async ({ data }): Promise<TmdbWorld> => {
    const { world, LANG } = await import("./tmdb.server");
    return world(data.kind, LANG[data.locale], data.kids);
  });

const discoverSchema = z.object({
  type, locale,
  page: z.number().int().min(1).max(500).optional(),
  sort: z.enum(["popularity.desc", "vote_average.desc", "primary_release_date.desc", "first_air_date.desc", "vote_count.desc"]).optional(),
  genres: z.string().regex(/^[0-9,|]{1,60}$/).optional(),
  country: z.string().regex(/^[A-Z|]{2,80}$/).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  kids: z.boolean().optional(),
});
export type DiscoverInput = z.input<typeof discoverSchema>;

export const fetchTmdbDiscover = createServerFn({ method: "GET" })
  .inputValidator((d: DiscoverInput) => discoverSchema.parse(d))
  .handler(async ({ data }): Promise<TmdbPage> => {
    const { discover, cached, LANG, TTL } = await import("./tmdb.server");
    const lang = LANG[data.locale];
    const sort = data.sort?.includes("release_date") || data.sort?.includes("air_date")
      ? (data.type === "movie" ? "primary_release_date.desc" : "first_air_date.desc")
      : data.sort;
    const y = data.year;
    return cached(`tmdb:disc:${JSON.stringify(data)}`, TTL.popular, () =>
      discover({
        type: data.type, page: data.page, sort, genres: data.kids ? (data.type === "movie" ? "10751" : "10762") : data.genres,
        country: data.country, minVotes: data.sort === "vote_average.desc" ? 50 : undefined,
        dateGte: y ? `${y}-01-01` : undefined, dateLte: y ? `${y}-12-31` : undefined, certLte: data.kids ? "PG" : undefined,
      }, lang));
  });

export const fetchTmdbGenres = createServerFn({ method: "GET" })
  .inputValidator((d: { type: "movie" | "tv"; locale: TmdbLocale }) => z.object({ type, locale }).parse(d))
  .handler(async ({ data }) => {
    const { genreList, LANG } = await import("./tmdb.server");
    return genreList(data.type, LANG[data.locale]).catch(() => []);
  });

export const fetchTmdbDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { type: "movie" | "tv"; id: number; locale: TmdbLocale }) => z.object({ type, id: z.number().int().positive(), locale }).parse(d))
  .handler(async ({ data }): Promise<TmdbDetail | null> => {
    const { detail, cached, LANG, TTL } = await import("./tmdb.server");
    return cached(`tmdb:detail:${data.type}:${data.id}:${data.locale}`, TTL.detail, () => detail(data.type, data.id, LANG[data.locale]));
  });

export const fetchTmdbSeason = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; season: number; locale: TmdbLocale }) =>
    z.object({ id: z.number().int().positive(), season: z.number().int().min(0).max(200), locale }).parse(d))
  .handler(async ({ data }): Promise<TmdbSeason | null> => {
    const { season, cached, LANG, TTL } = await import("./tmdb.server");
    return cached(`tmdb:season:${data.id}:${data.season}:${data.locale}`, TTL.detail, () => season(data.id, data.season, LANG[data.locale]));
  });

export const fetchTmdbPerson = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; locale: TmdbLocale }) => z.object({ id: z.number().int().positive(), locale }).parse(d))
  .handler(async ({ data }): Promise<TmdbPerson | null> => {
    const { personDetail, cached, LANG, TTL } = await import("./tmdb.server");
    return cached(`tmdb:person:${data.id}:${data.locale}`, TTL.person, () => personDetail(data.id, LANG[data.locale]));
  });

export const fetchTmdbSearch = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string; locale: TmdbLocale }) => z.object({ q: z.string().trim().min(1).max(80), locale }).parse(d))
  .handler(async ({ data }): Promise<TmdbSearch> => {
    const { search, cached, LANG, TTL } = await import("./tmdb.server");
    return cached(`tmdb:search:${data.q.toLowerCase()}:${data.locale}`, TTL.search, () => search(data.q, LANG[data.locale]))
      .catch(() => ({ movies: [], tv: [], people: [] }));
  });

export const fetchTmdbCountry = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string; locale: TmdbLocale }) => z.object({ code: z.string().regex(/^[A-Z]{2}$/), locale }).parse(d))
  .handler(async ({ data }): Promise<TmdbCountryPage> => {
    const { countryPage, LANG } = await import("./tmdb.server");
    return countryPage(data.code, LANG[data.locale]);
  });

/** Ramadan titles are assigned by MOROBEST editors (ramadan_titles), never guessed from TMDB. */
export const fetchTmdbRamadan = createServerFn({ method: "GET" })
  .inputValidator((d: { year: number; locale: TmdbLocale }) => z.object({ year: z.number().int(), locale }).parse(d))
  .handler(async ({ data }): Promise<{ card: TmdbCard; country: string | null; airTime: string | null }[]> => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const { cardsFor, LANG } = await import("./tmdb.server");
    const db = publicDb();
    const { data: s } = await db.from("ramadan_seasons").select("id").eq("year", data.year).maybeSingle();
    if (!s) return [];
    const { data: rows } = await db.from("ramadan_titles").select("provider_id, media_type, country_code, air_time, ord").eq("season_id", s.id).eq("provider", "tmdb").order("ord");
    if (!rows?.length) return [];
    const list = await cardsFor(rows.map((r) => ({ type: r.media_type as "movie" | "tv", id: Number(r.provider_id) })), LANG[data.locale]);
    return list.map((card) => {
      const r = rows.find((x) => Number(x.provider_id) === card.tmdbId && x.media_type === card.type)!;
      return { card, country: r.country_code, airTime: r.air_time };
    });
  });

const STALE = 10 * 60_000;
export const tmdbWorldQuery = (kind: WorldKind, l: TmdbLocale, kids?: boolean) =>
  queryOptions({ queryKey: ["tmdb-world", kind, l, !!kids], queryFn: () => fetchTmdbWorld({ data: { kind, locale: l, kids } }), staleTime: STALE });
export const tmdbDetailQuery = (t: "movie" | "tv", id: number, l: TmdbLocale) =>
  queryOptions({ queryKey: ["tmdb-detail", t, id, l], queryFn: () => fetchTmdbDetail({ data: { type: t, id, locale: l } }), staleTime: 60 * 60_000 });
export const tmdbSeasonQuery = (id: number, season: number, l: TmdbLocale) =>
  queryOptions({ queryKey: ["tmdb-season", id, season, l], queryFn: () => fetchTmdbSeason({ data: { id, season, locale: l } }), staleTime: 60 * 60_000 });
export const tmdbPersonQuery = (id: number, l: TmdbLocale) =>
  queryOptions({ queryKey: ["tmdb-person", id, l], queryFn: () => fetchTmdbPerson({ data: { id, locale: l } }), staleTime: 60 * 60_000 });
export const tmdbCountryQuery = (code: string, l: TmdbLocale) =>
  queryOptions({ queryKey: ["tmdb-country", code, l], queryFn: () => fetchTmdbCountry({ data: { code, locale: l } }), staleTime: STALE });
export const tmdbSearchQuery = (q: string, l: TmdbLocale) =>
  queryOptions({ queryKey: ["tmdb-search", q.trim().toLowerCase(), l], queryFn: () => fetchTmdbSearch({ data: { q: q.trim(), locale: l } }), staleTime: STALE });

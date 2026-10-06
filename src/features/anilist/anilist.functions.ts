import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { AniBrowse, AniDetail, AniHome, AniPage, AniType } from "./types";

const type = z.enum(["ANIME", "MANGA"]);
const browseSchema = z.object({
  type,
  page: z.number().int().min(1).max(200).optional(),
  sort: z.enum(["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC", "START_DATE_DESC"]).optional(),
  genre: z.string().max(40).optional(),
  year: z.number().int().min(1940).max(2100).optional(),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).optional(),
  format: z.enum(["TV", "TV_SHORT", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC", "MANGA", "NOVEL", "ONE_SHOT"]).optional(),
  status: z.enum(["RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]).optional(),
  country: z.enum(["JP", "KR", "CN", "TW"]).optional(),
  q: z.string().max(80).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
});

export const fetchAniBrowse = createServerFn({ method: "GET" })
  .inputValidator((d: AniBrowse) => browseSchema.parse(d))
  .handler(async ({ data }): Promise<AniPage> => {
    const { cached, browse, TTL } = await import("./anilist.server");
    const ttl = data.q ? TTL.search : data.sort === "TRENDING_DESC" ? TTL.trending : TTL.popular;
    return cached(`al:browse:${JSON.stringify(data)}`, ttl, () => browse(data, 24));
  });

export const fetchAniSuggest = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string().min(2).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { cached, browse, TTL } = await import("./anilist.server");
    const q = data.q.trim().toLowerCase();
    return cached(`al:suggest:${q}`, TTL.search, async () => {
      const [a, m] = await Promise.all([browse({ type: "ANIME", q }, 6), browse({ type: "MANGA", q }, 4)]);
      return [...a.items, ...m.items];
    });
  });

const ANIME_ROWS: [string, AniBrowse][] = [
  ["trending", { type: "ANIME", sort: "TRENDING_DESC" }],
  ["airing", { type: "ANIME", status: "RELEASING", sort: "POPULARITY_DESC" }],
  ["popular", { type: "ANIME", sort: "POPULARITY_DESC" }],
  ["top", { type: "ANIME", sort: "SCORE_DESC" }],
  ["upcoming", { type: "ANIME", status: "NOT_YET_RELEASED", sort: "POPULARITY_DESC" }],
  ["movies", { type: "ANIME", format: "MOVIE", sort: "POPULARITY_DESC" }],
  ["Action", { type: "ANIME", genre: "Action", sort: "TRENDING_DESC" }],
  ["Fantasy", { type: "ANIME", genre: "Fantasy", sort: "TRENDING_DESC" }],
  ["Romance", { type: "ANIME", genre: "Romance", sort: "TRENDING_DESC" }],
  ["Sports", { type: "ANIME", genre: "Sports", sort: "POPULARITY_DESC" }],
  ["classic", { type: "ANIME", status: "FINISHED", sort: "SCORE_DESC", minScore: 80 }],
];
const MANGA_ROWS: [string, AniBrowse][] = [
  ["trending", { type: "MANGA", sort: "TRENDING_DESC" }],
  ["popular", { type: "MANGA", sort: "POPULARITY_DESC" }],
  ["top", { type: "MANGA", sort: "SCORE_DESC" }],
  ["ongoing", { type: "MANGA", status: "RELEASING", sort: "POPULARITY_DESC" }],
  ["manhwa", { type: "MANGA", country: "KR", sort: "POPULARITY_DESC" }],
  ["manhua", { type: "MANGA", country: "CN", sort: "POPULARITY_DESC" }],
  ["completed", { type: "MANGA", status: "FINISHED", sort: "SCORE_DESC" }],
  ["Romance", { type: "MANGA", genre: "Romance", sort: "TRENDING_DESC" }],
  ["Horror", { type: "MANGA", genre: "Horror", sort: "POPULARITY_DESC" }],
];

export const fetchAniHome = createServerFn({ method: "GET" })
  .inputValidator((d: { type: AniType }) => z.object({ type }).parse(d))
  .handler(async ({ data }): Promise<AniHome> => {
    const { cached, browse, TTL } = await import("./anilist.server");
    const defs = data.type === "ANIME" ? ANIME_ROWS : MANGA_ROWS;
    // One cached blob per world: a single cache hit serves the whole page.
    return cached(`al:home:${data.type}`, TTL.trending, async () => {
      const rows: AniHome["rows"] = [];
      for (const [key, p] of defs) {
        try { rows.push({ key, items: (await browse(p, 16)).items }); } catch (e) { console.error("row failed", key, e); }
      }
      if (!rows.length) throw new Error("AniList unavailable");
      const hero = (rows[0]?.items ?? []).filter((x) => x.backdrop).slice(0, 5);
      return { hero, rows };
    });
  });

export const fetchAniDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { type: AniType; id: number }) => z.object({ type, id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<AniDetail | null> => {
    const { cached, detail, TTL } = await import("./anilist.server");
    return cached(`al:detail:${data.type}:${data.id}`, TTL.detail, () => detail(data.type, data.id));
  });

const STALE = 10 * 60_000;
export const aniHomeQuery = (t: AniType) => queryOptions({ queryKey: ["al-home", t], queryFn: () => fetchAniHome({ data: { type: t } }), staleTime: STALE });
export const aniDetailQuery = (t: AniType, id: number) => queryOptions({ queryKey: ["al-detail", t, id], queryFn: () => fetchAniDetail({ data: { type: t, id } }), staleTime: STALE });
export const aniBrowseQuery = (p: AniBrowse) => queryOptions({ queryKey: ["al-browse", p], queryFn: () => fetchAniBrowse({ data: p }), staleTime: STALE });
export const idFromSlug = (slug: string) => Number(slug.match(/(\d+)$/)?.[1] ?? NaN);

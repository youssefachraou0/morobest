import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Country, ListParams, Named, TitleCard, TitleDetail } from "./types";

const kind = z.enum(["movie", "series", "anime", "manga"]);
const listSchema = z.object({
  kind: z.union([kind, z.array(kind)]).optional(),
  genre: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
  arab: z.boolean().optional(),
  kids: z.boolean().optional(),
  classic: z.boolean().optional(),
  status: z.string().max(20).optional(),
  format: z.string().max(20).optional(),
  year: z.number().int().optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(["popular", "newest", "oldest", "rating", "az"]).optional(),
  maxAge: z.number().int().min(0).max(18).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  ids: z.array(z.string().uuid()).max(200).optional(),
});

export const fetchTitles = createServerFn({ method: "GET" })
  .inputValidator((d: ListParams) => listSchema.parse(d))
  .handler(async ({ data }): Promise<TitleCard[]> => {
    const { publicDb, listTitles } = await import("./catalog.server");
    return listTitles(publicDb(), data);
  });

export type HomeData = {
  hero: TitleCard[];
  trending: TitleCard[];
  newReleases: TitleCard[];
  movies: TitleCard[];
  series: TitleCard[];
  arabic: TitleCard[];
  moroccan: TitleCard[];
  ramadan: TitleCard[];
  ramadanYear: number | null;
  anime: TitleCard[];
  manga: TitleCard[];
  kids: TitleCard[];
  classics: TitleCard[];
  gems: TitleCard[];
  collections: { slug: string; name_en: string; name_fr: string; name_ar: string; cover_url: string | null }[];
  countries: Country[];
};

export const fetchHome = createServerFn({ method: "GET" })
  .inputValidator((d: { maxAge?: number }) => z.object({ maxAge: z.number().int().optional() }).parse(d))
  .handler(async ({ data }): Promise<HomeData> => {
    const { publicDb, listTitles } = await import("./catalog.server");
    const db = publicDb();
    const m = data.maxAge;
    const { data: rs } = await db.from("ramadan_seasons").select("id, year").eq("is_current", true).maybeSingle();
    const ramadanIds = rs
      ? ((await db.from("ramadan_entries").select("title_id").eq("season_id", rs.id)).data ?? []).map((r) => r.title_id as string)
      : [];
    const [trending, newReleases, movies, series, arabic, moroccan, anime, manga, kids, classics, gems, ramadan, cols, countries] =
      await Promise.all([
        listTitles(db, { maxAge: m, limit: 10, kind: ["movie", "series", "anime"] }),
        listTitles(db, { maxAge: m, sort: "newest", limit: 16, kind: ["movie", "series", "anime"] }),
        listTitles(db, { maxAge: m, kind: "movie", limit: 16 }),
        listTitles(db, { maxAge: m, kind: "series", limit: 16 }),
        listTitles(db, { maxAge: m, arab: true, kind: "movie", limit: 16 }),
        listTitles(db, { maxAge: m, country: "morocco", limit: 16 }),
        listTitles(db, { maxAge: m, kind: "anime", limit: 16 }),
        listTitles(db, { maxAge: m, kind: "manga", limit: 16 }),
        listTitles(db, { kids: true, limit: 16 }),
        listTitles(db, { maxAge: m, classic: true, limit: 16 }),
        listTitles(db, { maxAge: m, sort: "rating", limit: 30 }),
        ramadanIds.length ? listTitles(db, { maxAge: m, ids: ramadanIds, limit: 16 }) : Promise.resolve([]),
        db.from("collections").select("slug, name_en, name_fr, name_ar, cover_url").order("ord"),
        db.from("countries").select("*").eq("is_arab", true).order("name_en"),
      ]);
    return {
      hero: trending.filter((t) => t.backdrop && t.kind !== "manga").slice(0, 5),
      trending, newReleases, movies, series, arabic, moroccan, anime, manga, kids, classics,
      gems: gems.filter((g) => g.popularity < 750).slice(0, 12),
      ramadan, ramadanYear: rs?.year ?? null,
      collections: cols.data ?? [],
      countries: (countries.data ?? []) as Country[],
    };
  });

export const fetchTitle = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<TitleDetail | null> => {
    const { publicDb, CARD_SELECT, toCard, listTitles } = await import("./catalog.server");
    const db = publicDb();
    const { data: row, error } = await db
      .from("titles")
      .select(
        `${CARD_SELECT}, release_date, trailer_url, studios(name),
         title_genres(genres(slug, name_en, name_fr, name_ar)),
         title_countries(countries(*)),
         title_languages(languages(*)),
         credits(role, character_name, ord, people(slug, name, name_ar, photo_url)),
         seasons(id, number, name, year, episodes(id, number, title, synopsis, runtime_min, air_date, thumbnail_url, intro_start_s, intro_end_s, recap_end_s)),
         manga_volumes(id, number, release_date, cover_url),
         manga_chapters(id, volume_id, number, title, release_date, readable, official_url)`,
      )
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) {
      console.error("fetchTitle failed", error);
      throw new Error("Catalog unavailable");
    }
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    const card = toCard(r);
    const genres: Named[] = (r.title_genres ?? []).map((g: any) => g.genres).filter(Boolean);
    const chapters = (r.manga_chapters ?? []) as any[];

    const { data: rel } = await db.from("title_relations").select("to_id, relation").eq("from_id", card.id);
    const relatedCards = rel?.length ? await listTitles(db, { ids: rel.map((x) => x.to_id as string), limit: 20 }) : [];
    const similar = genres[0]
      ? (await listTitles(db, { genre: genres[0].slug, limit: 13, maxAge: card.isKids ? 12 : undefined })).filter((t) => t.id !== card.id)
      : [];

    return {
      ...card,
      releaseDate: r.release_date,
      trailer: r.trailer_url,
      studio: r.studios ?? null,
      genres,
      countries: (r.title_countries ?? []).map((c: any) => c.countries).filter(Boolean),
      languages: (r.title_languages ?? []).map((l: any) => l.languages).filter(Boolean),
      credits: (r.credits ?? [])
        .sort((a: any, b: any) => a.ord - b.ord)
        .map((c: any) => ({ role: c.role, character: c.character_name, person: c.people })),
      seasons: (r.seasons ?? [])
        .sort((a: any, b: any) => a.number - b.number)
        .map((s: any) => ({ ...s, episodes: (s.episodes ?? []).sort((a: any, b: any) => a.number - b.number) })),
      volumes: (r.manga_volumes ?? [])
        .sort((a: any, b: any) => a.number - b.number)
        .map((v: any) => ({
          ...v,
          chapters: chapters.filter((c) => c.volume_id === v.id).sort((a, b) => Number(a.number) - Number(b.number)),
        })),
      related: relatedCards.map((t) => ({ ...t, relation: rel!.find((x) => x.to_id === t.id)!.relation })),
      similar: similar.slice(0, 12),
    };
  });

export const fetchTaxonomy = createServerFn({ method: "GET" }).handler(async () => {
  const { publicDb } = await import("./catalog.server");
  const db = publicDb();
  const [g, c] = await Promise.all([
    db.from("genres").select("slug, name_en, name_fr, name_ar").order("name_en"),
    db.from("countries").select("*").order("name_en"),
  ]);
  return { genres: (g.data ?? []) as Named[], countries: (c.data ?? []) as Country[] };
});

export const fetchRamadan = createServerFn({ method: "GET" })
  .inputValidator((d: { year?: number; maxAge?: number }) =>
    z.object({ year: z.number().int().optional(), maxAge: z.number().int().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { publicDb, listTitles } = await import("./catalog.server");
    const db = publicDb();
    const { data: seasons } = await db.from("ramadan_seasons").select("*").order("year", { ascending: false });
    const all = seasons ?? [];
    const season = data.year ? all.find((s) => s.year === data.year) : all.find((s) => s.is_current) ?? all[0];
    if (!season) return { seasons: all, season: null, entries: [] as { card: TitleCard; airTime: string | null; status: string; countries: string[] }[] };
    const { data: entries } = await db.from("ramadan_entries").select("title_id, air_time, status").eq("season_id", season.id);
    const ids = (entries ?? []).map((e) => e.title_id as string);
    const cards = ids.length ? await listTitles(db, { ids, maxAge: data.maxAge, limit: 100 }) : [];
    const { data: tc } = ids.length ? await db.from("title_countries").select("title_id, country_code").in("title_id", ids) : { data: [] };
    return {
      seasons: all,
      season,
      entries: cards.map((card) => {
        const e = entries!.find((x) => x.title_id === card.id)!;
        return {
          card, airTime: e.air_time, status: e.status,
          countries: (tc ?? []).filter((x) => x.title_id === card.id).map((x) => x.country_code as string),
        };
      }),
    };
  });

export const fetchCollections = createServerFn({ method: "GET" }).handler(async () => {
  const { publicDb } = await import("./catalog.server");
  const { data } = await publicDb().from("collections").select("slug, name_en, name_fr, name_ar, description_en, cover_url").order("ord");
  return data ?? [];
});

export const fetchCollection = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; maxAge?: number }) => z.object({ slug: z.string().max(80), maxAge: z.number().int().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { publicDb, listTitles } = await import("./catalog.server");
    const db = publicDb();
    const { data: col } = await db.from("collections").select("*, collection_items(title_id, ord)").eq("slug", data.slug).maybeSingle();
    if (!col) return null;
    const items = (col.collection_items ?? []) as { title_id: string; ord: number }[];
    const cards = items.length ? await listTitles(db, { ids: items.map((i) => i.title_id), maxAge: data.maxAge, limit: 100 }) : [];
    const order = new Map(items.map((i) => [i.title_id, i.ord]));
    return { ...col, titles: cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) };
  });

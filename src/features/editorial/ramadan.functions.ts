import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

export type RamadanEntry = {
  key: string; to: "/movie/$slug" | "/tv/$slug" | "/title/$slug"; slug: string; title: string;
  poster: string | null; backdrop: string | null; year: number | null; popularity: number;
  country: string | null; airTime: string | null; featured: boolean; status: "upcoming" | "airing" | "completed";
  schedule: string | null; createdAt: string; ord: number;
};
export type RamadanSeasonInfo = { id: string; year: number; name: string | null; startsOn: string; endsOn: string; hero: string | null; description: string | null };
export type RamadanHub = { season: RamadanSeasonInfo | null; seasons: { year: number }[]; entries: RamadanEntry[]; countries: { code: string; slug: string; name: string }[] };

/** Only editor-assigned titles appear; nothing is inferred from provider data. */
export const fetchRamadanHub = createServerFn({ method: "GET" })
  .inputValidator((d: { year?: number; locale: "en" | "fr" | "ar" }) => z.object({ year: z.number().int().optional(), locale: z.enum(["en", "fr", "ar"]) }).parse(d))
  .handler(async ({ data }): Promise<RamadanHub> => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const db = publicDb();
    const { data: all } = await db.from("ramadan_seasons").select("id, year, name_en, name_fr, name_ar, starts_on, ends_on, hero_image, description, is_active, is_featured, is_current, archived_at").order("year", { ascending: false });
    const visible = (all ?? []).filter((s) => s.is_active && !s.archived_at);
    const s = data.year ? visible.find((x) => x.year === data.year) : (visible.find((x) => x.is_featured || x.is_current) ?? visible[0]);
    const { data: cs } = await db.from("countries").select("code, slug, name_en, name_fr, name_ar").eq("is_arab", true);
    const countries = (cs ?? []).map((c) => ({ code: c.code, slug: c.slug, name: (data.locale === "ar" ? c.name_ar : data.locale === "fr" ? c.name_fr : c.name_en) || c.name_en }));
    const seasons = visible.map((x) => ({ year: x.year }));
    if (!s) return { season: null, seasons, entries: [], countries };
    const { data: rows } = await db.from("ramadan_titles").select("id, provider, provider_id, media_type, title_id, country_code, air_time, featured, status, release_schedule, created_at, ord, titles(slug, original_title, poster_url, backdrop_url, year, popularity)").eq("season_id", s.id).order("ord");
    const list = rows ?? [];
    const { cardsFor, LANG } = await import("@/features/tmdb/tmdb.server");
    const { tmdbImg } = await import("@/features/tmdb/image");
    const tm = list.filter((r) => r.provider === "tmdb");
    const cards = tm.length ? await cardsFor(tm.map((r) => ({ type: r.media_type as "movie" | "tv", id: Number(r.provider_id) })), LANG[data.locale]).catch(() => []) : [];
    const entries: RamadanEntry[] = [];
    for (const r of list) {
      const base = { key: r.id, country: r.country_code, airTime: r.air_time, featured: r.featured, status: r.status as RamadanEntry["status"], schedule: r.release_schedule, createdAt: r.created_at, ord: r.ord };
      if (r.provider === "tmdb") {
        const c = cards.find((x) => x.tmdbId === Number(r.provider_id) && x.type === r.media_type);
        if (!c) continue;
        entries.push({ ...base, to: c.type === "movie" ? "/movie/$slug" : "/tv/$slug", slug: c.slug, title: c.title, poster: tmdbImg(c.poster, "w342"), backdrop: tmdbImg(c.backdrop, "w1280"), year: c.year, popularity: c.popularity });
      } else {
        const t = r.titles as { slug: string; original_title: string; poster_url: string | null; backdrop_url: string | null; year: number | null; popularity: number } | null;
        if (!t) continue; // hidden, draft or demo titles are filtered by RLS
        entries.push({ ...base, to: "/title/$slug", slug: t.slug, title: t.original_title, poster: t.poster_url, backdrop: t.backdrop_url, year: t.year, popularity: t.popularity });
      }
    }
    const name = (data.locale === "ar" ? s.name_ar : data.locale === "fr" ? s.name_fr : s.name_en) || s.name_en;
    return { season: { id: s.id, year: s.year, name, startsOn: s.starts_on, endsOn: s.ends_on, hero: s.hero_image, description: s.description }, seasons, entries, countries };
  });

export const ramadanHubQuery = (year: number | undefined, locale: "en" | "fr" | "ar") =>
  queryOptions({ queryKey: ["ramadan-hub", year ?? "current", locale], queryFn: () => fetchRamadanHub({ data: { year, locale } }), staleTime: 60_000 });

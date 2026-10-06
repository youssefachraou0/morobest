import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TmdbCard } from "@/features/tmdb/types";
import type { AniCard } from "@/features/anilist/types";

export type Recommendation =
  | { source: "tmdb"; reason: string; item: TmdbCard }
  | { source: "anilist"; reason: string; item: AniCard };
export type RecommendResult = { items: Recommendation[]; error?: string };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export const recommendTitles = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string; locale: "en" | "fr" | "ar"; family?: boolean }) =>
    z.object({ prompt: z.string().trim().min(3).max(500), locale: z.enum(["en", "fr", "ar"]), family: z.boolean().optional() }).parse(d))
  .handler(async ({ data }): Promise<RecommendResult> => {
    const { askModel, GatewayError } = await import("./recommend.server");
    const tmdb = await import("@/features/tmdb/tmdb.server");
    const al = await import("@/features/anilist/anilist.server");
    const langName = { en: "English", fr: "French", ar: "Arabic" }[data.locale];
    let picks;
    try { picks = (await askModel(data.prompt, langName, !!data.family)).picks.slice(0, 10); }
    catch (e) { return { items: [], error: e instanceof GatewayError ? e.message : "The recommender is unavailable right now." }; }

    const lang = tmdb.LANG[data.locale];
    const resolved = await Promise.all(picks.map(async (p): Promise<Recommendation | null> => {
      try {
        if (p.kind === "anime") {
          const q = (p.original_title || p.title).slice(0, 80);
          const page = await al.cached(`al:browse:${JSON.stringify({ type: "ANIME", q })}`, al.TTL.search, () => al.browse({ type: "ANIME", q }, 5));
          const item = page.items[0];
          return item ? { source: "anilist", reason: p.reason, item } : null;
        }
        const q = p.title.slice(0, 80);
        const res = await tmdb.cached(`tmdb:search:${q.toLowerCase()}:${data.locale}`, tmdb.TTL.search, () => tmdb.search(q, lang));
        const list: TmdbCard[] = p.kind === "movie" ? res.movies : res.tv;
        const byYear = (c: TmdbCard) => !p.year || !c.year || Math.abs(Number(c.year) - p.year) <= 1;
        const item = list.find((c) => byYear(c) && (norm(c.title) === norm(p.title))) ?? list.find(byYear) ?? list[0];
        return item ? { source: "tmdb", reason: p.reason, item } : null;
      } catch { return null; }
    }));
    const seen = new Set<string>();
    const items = resolved.filter((r): r is Recommendation => {
      if (!r) return false;
      const k = `${r.source}:${r.item.id}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    return { items, error: items.length ? undefined : "No matching titles found — try describing it differently." };
  });

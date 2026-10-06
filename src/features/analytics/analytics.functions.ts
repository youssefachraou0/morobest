import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContentRef } from "@/features/editorial/canonical";

/** Behavioral trending + Admin analytics reads. Raw events are service-role only; staff read them through checked SQL functions. */
export type TrendingItem = { key: string; ref: ContentRef; title: string; poster: string | null; year: number | null; kind: string; score: number; viewers: number };

async function resolveKeys(rows: { content_key: string; score: number; viewers: number }[], locale: "en" | "fr" | "ar"): Promise<TrendingItem[]> {
  const { tmdbImg } = await import("@/features/tmdb/image");
  const { cardsFor, LANG } = await import("@/features/tmdb/tmdb.server");
  const al = await import("@/features/anilist/anilist.server");
  const { publicDb } = await import("@/features/catalog/catalog.server");
  const parsed = rows.map((r) => ({ r, parts: r.content_key.split(":") }));
  const tm = parsed.filter((p) => p.parts[0] === "tmdb").map((p) => ({ type: p.parts[1] === "movie" ? "movie" as const : "tv" as const, id: Number(p.parts[2]) }));
  const cards = tm.length ? await cardsFor(tm, LANG[locale]).catch(() => []) : [];
  const mbIds = parsed.filter((p) => p.parts[0] === "mb").map((p) => p.parts[1]!);
  const { data: mb } = mbIds.length ? await publicDb().from("titles").select("id, slug, original_title, poster_url, year, kind").in("id", mbIds) : { data: [] };
  const out: TrendingItem[] = [];
  for (const { r, parts } of parsed) {
    const base = { key: r.content_key, score: Number(r.score), viewers: Number(r.viewers) };
    if (parts[0] === "tmdb") {
      const c = cards.find((x) => x.tmdbId === Number(parts[2]) && x.type === (parts[1] === "movie" ? "movie" : "tv"));
      if (c) out.push({ ...base, ref: { kind: parts[1] === "movie" ? "movie" : "series", providerId: c.tmdbId, slug: c.slug }, title: c.title, poster: tmdbImg(c.poster, "w342"), year: c.year, kind: parts[1]! });
    } else if (parts[0] === "anilist") {
      const type = parts[1] === "anime" ? "ANIME" : "MANGA";
      const d = await al.cached(`al:detail:${type}:${parts[2]}`, al.TTL.detail, () => al.detail(type, Number(parts[2]))).catch(() => null);
      if (d) out.push({ ...base, ref: { kind: parts[1] as "anime" | "manga", providerId: d.aniListId, slug: d.slug }, title: d.title, poster: d.poster, year: d.year, kind: parts[1]! });
    } else {
      const t = (mb ?? []).find((x) => x.id === parts[1]);
      if (t) out.push({ ...base, ref: { kind: "title", slug: t.slug }, title: t.original_title, poster: t.poster_url, year: t.year, kind: t.kind });
    }
  }
  return out;
}

/** Public: titles ranked by recent, de-duplicated MOROBEST viewer behavior (no personal data returned). */
export const fetchBehavioralTrending = createServerFn({ method: "GET" })
  .inputValidator((d: { locale: "en" | "fr" | "ar" }) => z.object({ locale: z.enum(["en", "fr", "ar"]) }).parse(d))
  .handler(async ({ data }) => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const { data: rows, error } = await publicDb().rpc("trending_content", { _days: 14, _limit: 20 });
    if (error || !rows?.length) return [] as TrendingItem[];
    return resolveKeys(rows as any, data.locale);
  });
export const behavioralTrendingQuery = (locale: "en" | "fr" | "ar") =>
  queryOptions({ queryKey: ["mb-trending", locale], queryFn: () => fetchBehavioralTrending({ data: { locale } }), staleTime: 10 * 60_000 });

const rangeBase = z.object({ from: z.string().datetime(), to: z.string().datetime(), includeTest: z.boolean().optional() });
const validRange = (r: { from: string; to: string }) => new Date(r.from) < new Date(r.to) && new Date(r.to).getTime() - new Date(r.from).getTime() <= 400 * 864e5;
const range = rangeBase.refine(validRange, "Invalid date range");

export type Dashboard = {
  active_viewers: number; views_today: number; views_week: number; views: number; unique_viewers: number; page_views: number;
  watch_seconds: number; errors: number; fallbacks: number; completions: number; attempts: number; failed: number; test_events: number;
  titles: { title_id: string; name: string; slug: string; kind: string; views: number; unique: number; watch_seconds: number; completions: number; attempts: number; failed: number; link: { provider: string; content_type: string; provider_id: string } | null }[];
  searches: { q: string; n: number }[]; subtitles: { lang: string; n: number }[]; audio: { lang: string; n: number }[];
  error_list: { at: string; provider: string | null; message: string }[]; events: Record<string, number>;
  trending: TrendingItem[]; ctx: Record<string, number>;
};

export const adminAnalyticsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof range>) => range.parse(d))
  .handler(async ({ data, context }): Promise<Dashboard> => {
    const [{ data: d, error }, { data: tr }] = await Promise.all([
      context.supabase.rpc("analytics_dashboard", { _from: data.from, _to: data.to, _include_test: !!data.includeTest }),
      context.supabase.rpc("trending_content", { _days: 14, _limit: 10 }),
    ]);
    if (error) throw new Error(error.message.includes("forbidden") ? "Forbidden" : "Analytics are temporarily unavailable.");
    const trending = tr?.length ? await resolveKeys(tr as any, "en").catch(() => []) : [];
    return { ...(d as any), trending };
  });

export type TitleAnalytics = {
  views: number; unique: number; watch_seconds: number; completions: number; errors: number; attempts: number; failed: number;
  episodes: { episode_id: string; season: number; number: number; title: string; views: number; unique: number; completions: number; watch_seconds: number }[];
};
export const adminTitleAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { titleId: string } & z.input<typeof rangeBase>) => rangeBase.extend({ titleId: z.string().uuid() }).refine(validRange, "Invalid date range").parse(d))
  .handler(async ({ data, context }): Promise<TitleAnalytics> => {
    const { data: d, error } = await context.supabase.rpc("analytics_title", { _title: data.titleId, _from: data.from, _to: data.to, _include_test: !!data.includeTest });
    if (error) throw new Error(error.message.includes("forbidden") ? "Forbidden" : "Analytics are temporarily unavailable.");
    return d as any;
  });

/** Admin maintenance: roll up + retention now (admin/super_admin only, enforced in SQL). */
export const adminRunAnalyticsCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_analytics_cleanup");
    if (error) throw new Error(error.message.includes("forbidden") ? "Forbidden" : "Cleanup failed.");
    return data as { ran_at: string; raw_deleted: number; errors_deleted: number };
  });
/** Admin maintenance: delete all events flagged as test/QA traffic. */
export const adminPurgeTestAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_analytics_purge_test");
    if (error) throw new Error(error.message.includes("forbidden") ? "Forbidden" : "Purge failed.");
    return { deleted: Number(data ?? 0) };
  });

import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

/** Public editorial layer: MOROBEST overrides, SEO, slugs and playable links on top of TMDB/AniList metadata. */
export const CONTENT_TYPES = ["movie", "series", "anime", "manga"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type Provider = "tmdb" | "anilist";
const ct = z.enum(CONTENT_TYPES);
const provider = z.enum(["tmdb", "anilist"]);
const locale = z.enum(["en", "fr", "ar"]);

export type Override = { title: string | null; subtitle: string | null; tagline: string | null; overview: string | null; short_description: string | null };
export type SeoOverride = {
  slug: string | null; canonical_url: string | null; indexable: boolean; follow_links: boolean;
  seo_title_ar: string | null; seo_title_fr: string | null; seo_title_en: string | null;
  meta_description_ar: string | null; meta_description_fr: string | null; meta_description_en: string | null;
  og_title: string | null; og_description: string | null; og_image: string | null; schema: any;
};
export type Overlay = {
  override: Override | null;
  seo: SeoOverride | null;
  link: { titleId: string; slug: string; playable: boolean } | null;
};

export const providerFor = (c: ContentType): Provider => (c === "anime" || c === "manga" ? "anilist" : "tmdb");

/** Resolves a public URL slug: trailing provider id, custom SEO slug, or a stored redirect. */
export const resolveContentSlug = createServerFn({ method: "GET" })
  .inputValidator((d: { ct: ContentType; slug: string }) => z.object({ ct, slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ pid: number | null; redirectSlug: string | null }> => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const db = publicDb();
    const p = providerFor(data.ct);
    const trailing = data.slug.match(/-(\d+)$/)?.[1] ?? (/^\d+$/.test(data.slug) ? data.slug : null);
    if (trailing) {
      const { data: s } = await db.from("seo_overrides").select("slug").eq("provider", p).eq("content_type", data.ct).eq("provider_id", trailing).maybeSingle();
      return { pid: Number(trailing), redirectSlug: s?.slug && s.slug !== data.slug ? s.slug : null };
    }
    const { data: s } = await db.from("seo_overrides").select("provider_id").eq("content_type", data.ct).eq("slug", data.slug).maybeSingle();
    if (s) return { pid: Number(s.provider_id), redirectSlug: null };
    const { data: r } = await db.from("slug_redirects").select("provider_id").eq("content_type", data.ct).eq("old_slug", data.slug).maybeSingle();
    if (!r) return { pid: null, redirectSlug: null };
    const { data: cur } = await db.from("seo_overrides").select("slug").eq("provider", p).eq("content_type", data.ct).eq("provider_id", r.provider_id).maybeSingle();
    return { pid: Number(r.provider_id), redirectSlug: cur?.slug ?? `title-${r.provider_id}` };
  });

export const fetchOverlay = createServerFn({ method: "GET" })
  .inputValidator((d: { ct: ContentType; pid: number; locale: "en" | "fr" | "ar" }) => z.object({ ct, pid: z.number().int().positive(), locale }).parse(d))
  .handler(async ({ data }): Promise<Overlay> => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const db = publicDb();
    const p = providerFor(data.ct);
    const pid = String(data.pid);
    const [o, s, l] = await Promise.all([
      db.from("content_overrides").select("title, subtitle, tagline, overview, short_description").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid).eq("locale", data.locale).maybeSingle(),
      db.from("seo_overrides").select("slug, canonical_url, indexable, follow_links, seo_title_ar, seo_title_fr, seo_title_en, meta_description_ar, meta_description_fr, meta_description_en, og_title, og_description, og_image, schema").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid).maybeSingle(),
      db.from("content_links").select("title_id, titles(slug)").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid).eq("is_primary", true).maybeSingle(),
    ]);
    let link: Overlay["link"] = null;
    const t = l.data?.titles as { slug: string } | null | undefined;
    if (l.data && t) {
      const { data: units } = await db.rpc("public_playable_units", { _title: l.data.title_id });
      link = { titleId: l.data.title_id, slug: t.slug, playable: (units ?? []).length > 0 };
    }
    return { override: o.data ?? null, seo: (s.data as SeoOverride | null) ?? null, link };
  });

export type EpisodeAvailability = Record<number, { episodeId: string; playable: boolean }>;
/** Maps TMDB episode numbers of one season to linked MOROBEST episodes (manual links win over number matching). */
export const fetchEpisodeAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: { pid: number; season: number }) => z.object({ pid: z.number().int().positive(), season: z.number().int().min(0) }).parse(d))
  .handler(async ({ data }): Promise<{ slug: string | null; episodes: EpisodeAvailability }> => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const { episodeMapFor } = await import("./editorial.server");
    const db = publicDb();
    const { data: l } = await db.from("content_links").select("title_id, titles(slug)").eq("provider", "tmdb").eq("content_type", "series").eq("provider_id", String(data.pid)).eq("is_primary", true).maybeSingle();
    const t = l?.titles as { slug: string } | null | undefined;
    if (!l || !t) return { slug: null, episodes: {} };
    const map = await episodeMapFor(db, l.title_id, String(data.pid), data.season);
    const { data: units } = await db.rpc("public_playable_units", { _title: l.title_id });
    const ids = new Set((units ?? []).map((u) => u.episode_id));
    const whole = ids.has(null as never);
    const out: EpisodeAvailability = {};
    for (const [n, id] of Object.entries(map)) out[Number(n)] = { episodeId: id, playable: whole || ids.has(id) };
    return { slug: t.slug, episodes: out };
  });

/** Internal title ids that are represented by a provider result (used to show one search card per title). */
export const fetchLinkedTitleIds = createServerFn({ method: "GET" })
  .inputValidator((d: { ids: string[] }) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(d))
  .handler(async ({ data }) => {
    if (!data.ids.length) return [] as string[];
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const { data: rows } = await publicDb().from("content_links").select("title_id").in("title_id", data.ids).eq("is_primary", true);
    return [...new Set((rows ?? []).map((r) => r.title_id))];
  });

export const overlayQuery = (c: ContentType, pid: number, l: "en" | "fr" | "ar") =>
  queryOptions({ queryKey: ["overlay", c, pid, l], queryFn: () => fetchOverlay({ data: { ct: c, pid, locale: l } }), staleTime: 60_000 });
export const episodeAvailabilityQuery = (pid: number, season: number) =>
  queryOptions({ queryKey: ["ep-avail", pid, season], queryFn: () => fetchEpisodeAvailability({ data: { pid, season } }), staleTime: 60_000 });

/** Applies a manual override over provider text: override → provider (requested language, English fallback). */
export function applyOverride<T extends { title: string; overview?: string | null; synopsis?: string | null; tagline?: string | null }>(d: T, o: Override | null): T {
  if (!o) return d;
  return {
    ...d,
    title: o.title || d.title,
    ...(o.tagline ? { tagline: o.tagline } : {}),
    ...("overview" in d && o.overview ? { overview: o.overview } : {}),
    ...("synopsis" in d && o.overview ? { synopsis: o.overview } : {}),
  };
}

/** Builds head() meta with SEO overrides taking priority over generated defaults. */
export function seoHead(opts: {
  locale: "en" | "fr" | "ar"; title: string; description: string; image: string | null; path: string; seo: SeoOverride | null;
}) {
  const s = opts.seo;
  const t = (s?.[`seo_title_${opts.locale}`] || s?.seo_title_en || null) ?? `${opts.title} · MOROBEST`;
  const desc = (s?.[`meta_description_${opts.locale}`] || s?.meta_description_en || opts.description).slice(0, 300);
  const img = s?.og_image || opts.image;
  const meta: Record<string, string>[] = [
    { title: t }, { name: "description", content: desc },
    { property: "og:title", content: s?.og_title || t }, { property: "og:description", content: s?.og_description || desc },
    { property: "og:type", content: "video.other" }, { name: "twitter:card", content: "summary_large_image" },
  ];
  if (img && /^https?:\/\//.test(img)) meta.push({ property: "og:image", content: img }, { name: "twitter:image", content: img });
  if (s && (!s.indexable || !s.follow_links)) meta.push({ name: "robots", content: `${s.indexable ? "index" : "noindex"},${s.follow_links ? "follow" : "nofollow"}` });
  const scripts = s?.schema ? [{ type: "application/ld+json", children: JSON.stringify(s.schema) }] : [];
  return { meta, links: [{ rel: "canonical", href: s?.canonical_url || `https://morobest.lovable.app${opts.path}` }], scripts };
}

/** Current custom slugs keyed "contentType:providerId" — feeds getCanonicalContentUrl so cards link straight to the canonical URL. */
export const fetchSlugMap = createServerFn({ method: "GET" }).handler(async (): Promise<Record<string, string>> => {
  const { publicDb } = await import("@/features/catalog/catalog.server");
  const { data } = await publicDb().from("seo_overrides").select("content_type, provider_id, slug").not("slug", "is", null).limit(5000);
  return Object.fromEntries((data ?? []).map((r) => [`${r.content_type}:${r.provider_id}`, r.slug as string]));
});
export const slugMapQuery = () => queryOptions({ queryKey: ["editorial", "slug-map"], queryFn: () => fetchSlugMap(), staleTime: 5 * 60_000 });

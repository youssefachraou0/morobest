import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONTENT_TYPES, providerFor, type ContentType } from "./editorial.functions";

/** Admin content management. Every handler re-checks the caller's role server-side; RLS enforces it again on writes. */
const ct = z.enum(CONTENT_TYPES);
const ext = z.object({ ct, pid: z.number().int().positive() });
type Ext = z.infer<typeof ext>;
type Ctx = { supabase: any; userId: string };

const KIND: Record<ContentType, "movie" | "series" | "anime" | "manga"> = { movie: "movie", series: "series", anime: "anime", manga: "manga" };
const ref = (e: Ext) => `${providerFor(e.ct)}:${e.ct}:${e.pid}`;

async function guard(c: Ctx) {
  const { data, error } = await c.supabase.rpc("can_manage_content", { _user_id: c.userId });
  if (error || !data) throw new Error("Forbidden");
}
async function audit(c: Ctx, action: string, contentId: string, oldValue: unknown, newValue: unknown) {
  await c.supabase.from("admin_audit_log").insert({ admin_id: c.userId, action, content_id: contentId, old_value: (oldValue ?? null) as never, new_value: (newValue ?? null) as never });
}
const slugify = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "title";

type Meta = { title: string; originalTitle: string; year: number | null; poster: string | null; backdrop: string | null; overview: string | null; slug: string; seasons: { number: number; name: string; episodeCount: number }[] };
async function metadata(e: Ext): Promise<Meta | null> {
  if (providerFor(e.ct) === "tmdb") {
    const { detail, cached, LANG, TTL } = await import("@/features/tmdb/tmdb.server");
    const { tmdbImg } = await import("@/features/tmdb/image");
    const t = e.ct === "movie" ? "movie" : "tv";
    const d = await cached(`tmdb:detail:${t}:${e.pid}:en`, TTL.detail, () => detail(t, e.pid, LANG.en));
    if (!d) return null;
    return { title: d.title, originalTitle: d.originalTitle, year: d.year, poster: tmdbImg(d.poster, "w500"), backdrop: tmdbImg(d.backdrop, "w1280"), overview: d.overview, slug: d.slug, seasons: d.seasons ?? [] };
  }
  const { detail, cached, TTL } = await import("@/features/anilist/anilist.server");
  const type = e.ct === "anime" ? "ANIME" : "MANGA";
  const d = await cached(`al:detail:${type}:${e.pid}`, TTL.detail, () => detail(type, e.pid));
  if (!d) return null;
  return { title: d.title, originalTitle: d.originalTitle, year: d.year, poster: d.poster, backdrop: d.backdrop, overview: d.synopsis, slug: d.slug, seasons: [] };
}

// ---------- Search ----------
export const adminSearchExternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { source: "tmdb" | "anilist" | "morobest"; q: string }) => z.object({ source: z.enum(["tmdb", "anilist", "morobest"]), q: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    type Hit = { ct: ContentType | null; pid: number | null; titleId: string | null; title: string; originalTitle: string; year: number | null; poster: string | null; linkedTitle: { id: string; slug: string; name: string } | null };
    let hits: Hit[] = [];
    if (data.source === "morobest") {
      const { data: rows } = await context.supabase.from("titles").select("id, slug, kind, original_title, year, poster_url, is_demo, content_status").ilike("original_title", `%${data.q}%`).is("deleted_at", null).limit(20);
      return (rows ?? []).map((r: any) => ({ ct: null, pid: null, titleId: r.id, title: `${r.original_title}${r.is_demo ? " · DEMO" : ""} · ${r.content_status}`, originalTitle: r.kind, year: r.year, poster: r.poster_url, linkedTitle: null })) as Hit[];
    }
    if (data.source === "tmdb") {
      const { search, LANG } = await import("@/features/tmdb/tmdb.server");
      const { tmdbImg } = await import("@/features/tmdb/image");
      const r = await search(data.q, LANG.en);
      hits = [...r.movies, ...r.tv].slice(0, 24).map((c) => ({ ct: c.type === "movie" ? "movie" : "series", pid: c.tmdbId, titleId: null, title: c.title, originalTitle: c.originalTitle, year: c.year, poster: tmdbImg(c.poster, "w185"), linkedTitle: null }));
    } else {
      const { browse } = await import("@/features/anilist/anilist.server");
      const [a, m] = await Promise.all([browse({ type: "ANIME", q: data.q }, 12), browse({ type: "MANGA", q: data.q }, 8)]);
      hits = [...a.items.map((c) => ({ c, t: "anime" as const })), ...m.items.map((c) => ({ c, t: "manga" as const }))].map(({ c, t }) => ({ ct: t, pid: c.aniListId, titleId: null, title: c.title, originalTitle: c.originalTitle, year: c.year, poster: c.poster, linkedTitle: null }));
    }
    const ids = hits.map((h) => String(h.pid));
    if (ids.length) {
      const { data: links } = await context.supabase.from("content_links").select("content_type, provider_id, titles(id, slug, original_title)").in("provider_id", ids).eq("is_primary", true);
      for (const h of hits) {
        const l = (links ?? []).find((x: any) => x.content_type === h.ct && x.provider_id === String(h.pid));
        if (l?.titles) h.linkedTitle = { id: l.titles.id, slug: l.titles.slug, name: l.titles.original_title };
      }
    }
    return hits;
  });

// ---------- Title detail ----------
export const adminContentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext) => ext.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const p = providerFor(data.ct);
    const pid = String(data.pid);
    const meta = await metadata(data).catch(() => null);
    const [{ data: link }, { data: overrides }, { data: seo }, { data: logs }] = await Promise.all([
      context.supabase.from("content_links").select("id, title_id, linked_at, linked_by, titles(id, slug, original_title, year, content_status, is_demo, published)").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid).eq("is_primary", true).maybeSingle(),
      context.supabase.from("content_overrides").select("*").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid),
      context.supabase.from("seo_overrides").select("*").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid).maybeSingle(),
      context.supabase.from("admin_audit_log").select("id, admin_id, action, old_value, new_value, created_at").eq("content_id", ref(data)).order("created_at", { ascending: false }).limit(50),
    ]);
    let sources: { id: string; provider: string | null; status: string; is_active: boolean; is_test_source: boolean; episode_id: string | null; language: string | null }[] = [];
    let ramadan: unknown[] = [];
    if (link?.title_id) {
      const { data: s } = await context.supabase.from("video_sources").select("id, provider, status, is_active, is_test_source, episode_id, language").eq("title_id", link.title_id);
      sources = s ?? [];
    }
    const { data: rm } = await context.supabase.from("ramadan_titles").select("id, country_code, featured, status, air_time, ramadan_seasons(year)").eq("provider", p).eq("provider_id", pid);
    ramadan = rm ?? [];
    // Likely duplicates among internal titles (same title/original title + year)
    let duplicates: { id: string; slug: string; original_title: string; year: number | null; linked: boolean }[] = [];
    if (meta) {
      const names = [...new Set([meta.title, meta.originalTitle])].map((n) => n.replace(/[%,()]/g, " "));
      const { data: d } = await context.supabase.from("titles").select("id, slug, original_title, year, content_links(id)").or(names.map((n) => `original_title.ilike.${n}`).join(",")).is("deleted_at", null).limit(10);
      duplicates = (d ?? []).filter((t: any) => !meta.year || !t.year || t.year === meta.year).map((t: any) => ({ id: t.id, slug: t.slug, original_title: t.original_title, year: t.year, linked: (t.content_links ?? []).length > 0 }));
    }
    return { provider: p, ref: ref(data), meta, link: link ?? null, overrides: overrides ?? [], seo: seo ?? null, audit: logs ?? [], sources, ramadan, duplicates };
  });

// ---------- Linking ----------
export const adminLinkExisting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext & { titleId: string }) => ext.extend({ titleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const p = providerFor(data.ct);
    const pid = String(data.pid);
    const { data: other } = await context.supabase.from("content_links").select("provider_id").eq("title_id", data.titleId).eq("provider", p).eq("is_primary", true).maybeSingle();
    if (other && other.provider_id !== pid) throw new Error(`That MOROBEST title is already linked to ${p} #${other.provider_id}. Unlink it first.`);
    const { data: cur } = await context.supabase.from("content_links").select("id, title_id").eq("provider", p).eq("content_type", data.ct).eq("provider_id", pid).eq("is_primary", true).maybeSingle();
    if (cur) {
      const { error } = await context.supabase.from("content_links").update({ title_id: data.titleId, linked_at: new Date().toISOString(), linked_by: context.userId }).eq("id", cur.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("content_links").insert({ title_id: data.titleId, provider: p, provider_id: pid, content_type: data.ct, is_primary: true, linked_by: context.userId });
      if (error) throw new Error(error.message);
    }
    await audit(context, cur ? "link.change" : "link.create", ref(data), cur ? { title_id: cur.title_id } : null, { title_id: data.titleId });
    return { ok: true };
  });

export const adminCreateAndLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext & { force?: boolean }) => ext.extend({ force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const p = providerFor(data.ct);
    const { data: cur } = await context.supabase.from("content_links").select("title_id").eq("provider", p).eq("content_type", data.ct).eq("provider_id", String(data.pid)).eq("is_primary", true).maybeSingle();
    if (cur) throw new Error("This title is already linked. Use Change Link instead.");
    const meta = await metadata(data);
    if (!meta) throw new Error("Provider metadata unavailable");
    if (!data.force) {
      const { data: dup } = await context.supabase.from("titles").select("id, original_title, year").or(`original_title.ilike.${meta.originalTitle.replace(/[%,()]/g, " ")},original_title.ilike.${meta.title.replace(/[%,()]/g, " ")}`).is("deleted_at", null).limit(5);
      const same = (dup ?? []).filter((t: any) => !meta.year || !t.year || t.year === meta.year);
      if (same.length) return { ok: false as const, duplicates: same as { id: string; original_title: string; year: number | null }[] };
    }
    const base = `${slugify(meta.title)}${meta.year ? `-${meta.year}` : ""}`;
    const { data: taken } = await context.supabase.from("titles").select("slug").like("slug", `${base}%`);
    const slug = (taken ?? []).some((t: any) => t.slug === base) ? `${base}-${data.pid}` : base;
    const { data: t, error } = await context.supabase.from("titles").insert({
      slug, kind: KIND[data.ct], original_title: meta.originalTitle || meta.title, year: meta.year, poster_url: meta.poster, backdrop_url: meta.backdrop,
      published: true, content_status: "published", is_demo: false, age_rating: 0, status: "released", popularity: 0, is_kids: false, is_classic: false,
    }).select("id, slug").single();
    if (error) throw new Error(error.message);
    await context.supabase.from("title_translations").insert({ title_id: t.id, locale: "en", title: meta.title, synopsis: meta.overview });
    const { error: le } = await context.supabase.from("content_links").insert({ title_id: t.id, provider: p, provider_id: String(data.pid), content_type: data.ct, is_primary: true, linked_by: context.userId });
    if (le) throw new Error(le.message);
    await audit(context, "link.create_title", ref(data), null, { title_id: t.id, slug: t.slug });
    return { ok: true as const, titleId: t.id as string, slug: t.slug as string };
  });

export const adminUnlink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext) => ext.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const p = providerFor(data.ct);
    const { data: cur } = await context.supabase.from("content_links").delete().eq("provider", p).eq("content_type", data.ct).eq("provider_id", String(data.pid)).select("title_id");
    await audit(context, "link.remove", ref(data), cur?.[0] ?? null, null);
    return { ok: true };
  });

export const adminSetTitleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { titleId: string; status?: "draft" | "published" | "hidden" | "archived"; isDemo?: boolean }) =>
    z.object({ titleId: z.string().uuid(), status: z.enum(["draft", "published", "hidden", "archived"]).optional(), isDemo: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: old } = await context.supabase.from("titles").select("content_status, is_demo").eq("id", data.titleId).single();
    const patch: Record<string, unknown> = {};
    if (data.status) patch.content_status = data.status;
    if (data.isDemo !== undefined) patch.is_demo = data.isDemo;
    const { error } = await context.supabase.from("titles").update(patch).eq("id", data.titleId);
    if (error) throw new Error(error.message);
    await audit(context, "title.status", `title:${data.titleId}`, old, patch);
    return { ok: true };
  });

// ---------- Localization & SEO ----------
const ovFields = z.object({ title: z.string().max(300).nullable(), subtitle: z.string().max(300).nullable(), tagline: z.string().max(500).nullable(), overview: z.string().max(5000).nullable(), short_description: z.string().max(500).nullable() });
export const adminSaveOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext & { locale: "en" | "fr" | "ar"; fields: z.infer<typeof ovFields> }) => ext.extend({ locale: z.enum(["en", "fr", "ar"]), fields: ovFields }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const p = providerFor(data.ct);
    const key = { provider: p, content_type: data.ct, provider_id: String(data.pid), locale: data.locale };
    const clean = Object.fromEntries(Object.entries(data.fields).map(([k, v]) => [k, v?.trim() ? v.trim() : null]));
    const { data: old } = await context.supabase.from("content_overrides").select("title, subtitle, tagline, overview, short_description").match(key).maybeSingle();
    const { error } = await context.supabase.from("content_overrides").upsert({ ...key, ...clean, updated_by: context.userId, updated_at: new Date().toISOString() }, { onConflict: "provider,content_type,provider_id,locale" });
    if (error) throw new Error(error.message);
    await audit(context, `translation.${data.locale}`, ref(data), old, clean);
    return { ok: true };
  });

const seoFields = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and dashes").max(120).nullable(),
  canonical_url: z.string().url().max(500).nullable(), indexable: z.boolean(), follow_links: z.boolean(),
  seo_title_ar: z.string().max(200).nullable(), seo_title_fr: z.string().max(200).nullable(), seo_title_en: z.string().max(200).nullable(),
  meta_description_ar: z.string().max(400).nullable(), meta_description_fr: z.string().max(400).nullable(), meta_description_en: z.string().max(400).nullable(),
  og_title: z.string().max(200).nullable(), og_description: z.string().max(400).nullable(), og_image: z.string().url().max(500).nullable(),
  schema: z.record(z.string(), z.unknown()).nullable(),
});
export const adminSaveSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext & { currentSlug: string; fields: z.input<typeof seoFields> }) => ext.extend({ currentSlug: z.string().max(200), fields: seoFields }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const p = providerFor(data.ct);
    const key = { provider: p, content_type: data.ct, provider_id: String(data.pid) };
    const { data: old } = await context.supabase.from("seo_overrides").select("*").match(key).maybeSingle();
    if (data.fields.slug && /-\d+$/.test(data.fields.slug)) throw new Error("Custom slugs cannot end with -number (reserved for provider ids).");
    const { error } = await context.supabase.from("seo_overrides").upsert({ ...key, ...data.fields, schema: data.fields.schema as never, updated_by: context.userId, updated_at: new Date().toISOString() }, { onConflict: "provider,content_type,provider_id" });
    if (error) throw new Error(error.message.includes("seo_overrides_slug") ? "That slug is already used by another title." : error.message);
    const prev = old?.slug ?? null;
    if (prev && prev !== data.fields.slug) {
      await context.supabase.from("slug_redirects").upsert({ content_type: data.ct, old_slug: prev, provider: p, provider_id: String(data.pid) }, { onConflict: "content_type,old_slug" });
    }
    if (data.fields.slug) await context.supabase.from("slug_redirects").delete().eq("content_type", data.ct).eq("old_slug", data.fields.slug);
    await audit(context, "seo.update", ref(data), old, data.fields);
    return { ok: true };
  });

// ---------- Provider sync ----------
export const adminRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Ext & { what: "metadata" | "images" | "credits" | "episodes" }) => ext.extend({ what: z.enum(["metadata", "images", "credits", "episodes"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    // Only provider caches are cleared. MOROBEST overrides, SEO, Ramadan, sources and subtitles live in separate tables and are never touched.
    if (providerFor(data.ct) === "tmdb") {
      const t = data.ct === "movie" ? "movie" : "tv";
      const { forget } = await import("@/features/tmdb/tmdb.server");
      await forget(data.what === "episodes" ? [`tmdb:season:${data.pid}:`] : [`tmdb:detail:${t}:${data.pid}:`]);
    } else {
      const { forgetMemory } = await import("@/features/anilist/anilist.server");
      const type = data.ct === "anime" ? "ANIME" : "MANGA";
      forgetMemory([`al:detail:${type}:${data.pid}`]);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("provider_cache").delete().like("key", `al:detail:${type}:${data.pid}%`);
    }
    await audit(context, `sync.${data.what}`, ref(data), null, null);
    return { ok: true };
  });

// ---------- Series / episode mapping ----------
export const adminEpisodeMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pid: number; season: number }) => z.object({ pid: z.number().int().positive(), season: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { season, cached, LANG, TTL } = await import("@/features/tmdb/tmdb.server");
    const { episodeMapFor } = await import("./editorial.server");
    const s = await cached(`tmdb:season:${data.pid}:${data.season}:en`, TTL.detail, () => season(data.pid, data.season, LANG.en));
    const { data: l } = await context.supabase.from("content_links").select("title_id").eq("provider", "tmdb").eq("content_type", "series").eq("provider_id", String(data.pid)).eq("is_primary", true).maybeSingle();
    if (!l) return { linked: false, rows: [], internal: [] };
    const map = await episodeMapFor(context.supabase, l.title_id, String(data.pid), data.season);
    const { data: seasons } = await context.supabase.from("seasons").select("number, episodes(id, number, title)").eq("title_id", l.title_id).order("number");
    const internal = (seasons ?? []).flatMap((x: any) => (x.episodes ?? []).map((e: any) => ({ id: e.id as string, label: `S${String(x.number).padStart(2, "0")}E${String(e.number).padStart(2, "0")} · ${e.title}` })));
    const { data: src } = await context.supabase.from("video_sources").select("episode_id, status, is_active").eq("title_id", l.title_id);
    const ready = (id: string) => (src ?? []).some((v: any) => v.is_active && v.status === "ready" && (v.episode_id === id || v.episode_id === null));
    const { data: manual } = await context.supabase.from("episode_links").select("episode_number").eq("provider", "tmdb").eq("provider_id", String(data.pid)).eq("season_number", data.season);
    const manualSet = new Set((manual ?? []).map((m: any) => m.episode_number));
    const rows = (s?.episodes ?? []).map((e) => ({ number: e.number, title: e.title, episodeId: map[e.number] ?? null, manual: manualSet.has(e.number), ready: map[e.number] ? ready(map[e.number]) : false }));
    return { linked: true, rows, internal };
  });

export const adminSetEpisodeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pid: number; season: number; episode: number; episodeId: string | null; reset?: boolean }) =>
    z.object({ pid: z.number().int().positive(), season: z.number().int().min(0), episode: z.number().int().min(0), episodeId: z.string().uuid().nullable(), reset: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: l } = await context.supabase.from("content_links").select("title_id").eq("provider", "tmdb").eq("content_type", "series").eq("provider_id", String(data.pid)).eq("is_primary", true).single();
    const key = { provider: "tmdb", provider_id: String(data.pid), season_number: data.season, episode_number: data.episode };
    if (data.reset) await context.supabase.from("episode_links").delete().match(key);
    else {
      const { error } = await context.supabase.from("episode_links").upsert({ ...key, series_title_id: l.title_id, episode_id: data.episodeId, is_manual: true, updated_at: new Date().toISOString() }, { onConflict: "provider,provider_id,season_number,episode_number" });
      if (error) throw new Error(error.message);
    }
    await audit(context, "episode.link", `tmdb:series:${data.pid}`, null, { ...key, episode_id: data.reset ? "auto" : data.episodeId });
    return { ok: true };
  });

/** Refresh Episodes: creates missing MOROBEST seasons/episodes from TMDB numbers; never edits existing ones. */
export const adminSyncEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pid: number }) => z.object({ pid: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { detail, season, cached, LANG, TTL } = await import("@/features/tmdb/tmdb.server");
    const { data: l } = await context.supabase.from("content_links").select("title_id").eq("provider", "tmdb").eq("content_type", "series").eq("provider_id", String(data.pid)).eq("is_primary", true).maybeSingle();
    if (!l) throw new Error("Link this series to a MOROBEST title first.");
    const d = await cached(`tmdb:detail:tv:${data.pid}:en`, TTL.detail, () => detail("tv", data.pid, LANG.en));
    let created = 0;
    for (const s of (d?.seasons ?? []).filter((x) => x.number > 0)) {
      let { data: row } = await context.supabase.from("seasons").select("id").eq("title_id", l.title_id).eq("number", s.number).maybeSingle();
      if (!row) {
        const r = await context.supabase.from("seasons").insert({ title_id: l.title_id, number: s.number, name: s.name }).select("id").single();
        if (r.error) throw new Error(r.error.message);
        row = r.data;
      }
      const eps = await cached(`tmdb:season:${data.pid}:${s.number}:en`, TTL.detail, () => season(data.pid, s.number, LANG.en));
      const { data: have } = await context.supabase.from("episodes").select("number").eq("season_id", row!.id);
      const nums = new Set((have ?? []).map((e: any) => e.number));
      const missing = (eps?.episodes ?? []).filter((e) => !nums.has(e.number)).map((e) => ({ season_id: row!.id, number: e.number, title: e.title || `Episode ${e.number}`, synopsis: e.overview, runtime_min: e.runtime, air_date: e.airDate }));
      if (missing.length) {
        const { error } = await context.supabase.from("episodes").insert(missing);
        if (error) throw new Error(error.message);
        created += missing.length;
      }
    }
    await audit(context, "sync.episodes", `tmdb:series:${data.pid}`, null, { created });
    return { created };
  });

// ---------- Internal titles (demo cleanup) ----------
export const adminListTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { showDemo: boolean }) => z.object({ showDemo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    let q = context.supabase.from("titles").select("id, slug, kind, original_title, year, is_demo, content_status, published, content_links(provider, content_type, provider_id), video_sources(id, is_test_source)").is("deleted_at", null).order("created_at", { ascending: false }).limit(300);
    if (!data.showDemo) q = q.eq("is_demo", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string, slug: r.slug as string, kind: r.kind as string, name: r.original_title as string, year: r.year as number | null, isDemo: r.is_demo as boolean, status: r.content_status as string,
      links: (r.content_links ?? []) as { provider: string; content_type: string; provider_id: string }[],
      realSources: (r.video_sources ?? []).filter((v: any) => !v.is_test_source).length as number, testSources: (r.video_sources ?? []).filter((v: any) => v.is_test_source).length as number,
    }));
  });

/** Super Admin only: permanently removes a legacy title that has no links and no real video sources. */
export const adminDeleteTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { titleId: string }) => z.object({ titleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sa } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!sa) throw new Error("Only a Super Admin can permanently delete titles.");
    const { data: t } = await context.supabase.from("titles").select("id, original_title, is_demo, content_links(id), video_sources(id, is_test_source)").eq("id", data.titleId).single();
    if (!t) throw new Error("Not found");
    if ((t.content_links ?? []).length || (t.video_sources ?? []).some((v: any) => !v.is_test_source)) throw new Error("This title has production links or real videos — archive it instead.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove dependent rows first; legacy schema has non-cascading foreign keys.
    const sources = (t.video_sources ?? []).map((v: any) => v.id);
    if (sources.length) {
      await supabaseAdmin.from("subtitle_tracks").delete().in("video_source_id", sources);
      await supabaseAdmin.from("playback_errors").delete().in("source_id", sources);
      await supabaseAdmin.from("video_sources").delete().in("id", sources);
    }
    const { data: seasons } = await supabaseAdmin.from("seasons").select("id").eq("title_id", t.id);
    const sids = (seasons ?? []).map((s) => s.id);
    if (sids.length) {
      const { data: eps } = await supabaseAdmin.from("episodes").select("id").in("season_id", sids);
      const eids = (eps ?? []).map((e) => e.id);
      if (eids.length) await supabaseAdmin.from("playback_progress").delete().in("episode_id", eids);
      await supabaseAdmin.from("episodes").delete().in("season_id", sids);
      await supabaseAdmin.from("seasons").delete().in("id", sids);
    }
    for (const tbl of ["title_translations", "title_genres", "title_countries", "title_languages", "credits", "collection_items", "ramadan_entries", "watchlist", "favorites", "ratings", "playback_progress", "manga_chapters", "manga_volumes"] as const) {
      await supabaseAdmin.from(tbl).delete().eq("title_id", t.id);
    }
    await supabaseAdmin.from("title_relations").delete().or(`from_id.eq.${t.id},to_id.eq.${t.id}`);
    const { error } = await supabaseAdmin.from("titles").delete().eq("id", t.id);
    if (error) throw new Error(error.message);
    await audit(context, "title.delete", `title:${t.id}`, { name: t.original_title, is_demo: t.is_demo }, null);
    return { ok: true };
  });

export const adminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contentId?: string }) => z.object({ contentId: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    let q = context.supabase.from("admin_audit_log").select("id, admin_id, action, content_id, old_value, new_value, created_at").order("created_at", { ascending: false }).limit(200);
    if (data.contentId) q = q.eq("content_id", data.contentId);
    const { data: rows } = await q;
    return (rows ?? []) as { id: string; admin_id: string; action: string; content_id: string | null; old_value: unknown; new_value: unknown; created_at: string }[];
  });

// ---------- Ramadan ----------
const seasonFields = z.object({
  id: z.string().uuid().optional(), year: z.number().int().min(1990).max(2100), name_ar: z.string().max(120).nullable(), name_fr: z.string().max(120).nullable(), name_en: z.string().max(120).nullable(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hero_image: z.string().url().max(500).nullable(), description: z.string().max(2000).nullable(),
  is_active: z.boolean(), is_featured: z.boolean(), archived: z.boolean().optional(),
});
export const adminRamadanSeasons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { data } = await context.supabase.from("ramadan_seasons").select("*, ramadan_titles(count)").order("year", { ascending: false });
    return (data ?? []) as any[];
  });
export const adminSaveRamadanSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof seasonFields>) => seasonFields.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { id, archived, ...f } = data;
    const row = { ...f, is_current: f.is_featured, ...(archived !== undefined ? { archived_at: archived ? new Date().toISOString() : null } : {}) };
    if (f.is_featured) await context.supabase.from("ramadan_seasons").update({ is_featured: false, is_current: false }).neq("year", f.year);
    const r = id ? await context.supabase.from("ramadan_seasons").update(row).eq("id", id).select("id").single() : await context.supabase.from("ramadan_seasons").insert(row).select("id").single();
    if (r.error) throw new Error(r.error.message.includes("duplicate") ? "A season for that year already exists." : r.error.message);
    await audit(context, id ? "ramadan.season.update" : "ramadan.season.create", `ramadan:${f.year}`, null, row);
    return { id: r.data.id as string };
  });
export const adminRamadanAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { seasonId: string }) => z.object({ seasonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: rows } = await context.supabase.from("ramadan_titles").select("*, titles(original_title, poster_url)").eq("season_id", data.seasonId).order("ord");
    const tm = (rows ?? []).filter((r: any) => r.provider === "tmdb");
    if (tm.length) {
      const { cardsFor, LANG } = await import("@/features/tmdb/tmdb.server");
      const cards = await cardsFor(tm.map((r: any) => ({ type: r.media_type, id: Number(r.provider_id) })), LANG.en).catch(() => []);
      for (const r of tm) { const c = cards.find((x) => x.tmdbId === Number(r.provider_id) && x.type === r.media_type); r.label = c?.title ?? `TMDB #${r.provider_id}`; r.poster = c?.poster ? `https://image.tmdb.org/t/p/w92${c.poster}` : null; }
    }
    for (const r of rows ?? []) if (r.provider === "morobest") { r.label = r.titles?.original_title ?? "MOROBEST title"; r.poster = r.titles?.poster_url ?? null; }
    return (rows ?? []) as any[];
  });
const assign = z.object({
  id: z.string().uuid().optional(), seasonId: z.string().uuid(), source: z.enum(["tmdb", "morobest"]), pid: z.string().max(64), mediaType: z.enum(["movie", "tv"]),
  country: z.string().regex(/^[A-Z]{2}$/).nullable(), featured: z.boolean(), ord: z.number().int().min(0).max(9999), airTime: z.string().max(20).nullable(),
  releaseSchedule: z.string().max(300).nullable(), notes: z.string().max(1000).nullable(), status: z.enum(["upcoming", "airing", "completed"]),
});
export const adminAssignRamadan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof assign>) => assign.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const row = {
      season_id: data.seasonId, provider: data.source, provider_id: data.pid, media_type: data.mediaType, title_id: data.source === "morobest" ? data.pid : null,
      country_code: data.country, featured: data.featured, ord: data.ord, air_time: data.airTime, release_schedule: data.releaseSchedule, notes: data.notes, status: data.status,
    };
    const r = data.id ? await context.supabase.from("ramadan_titles").update(row).eq("id", data.id) : await context.supabase.from("ramadan_titles").upsert(row, { onConflict: "season_id,provider,media_type,provider_id" });
    if (r.error) throw new Error(r.error.message);
    await audit(context, "ramadan.assign", `${data.source}:${data.mediaType}:${data.pid}`, null, row);
    return { ok: true };
  });
export const adminRemoveRamadan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: old } = await context.supabase.from("ramadan_titles").delete().eq("id", data.id).select("*");
    await audit(context, "ramadan.remove", old?.[0] ? `${old[0].provider}:${old[0].media_type}:${old[0].provider_id}` : "ramadan", old?.[0] ?? null, null);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ip = () => getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

type Reason = "rate_limited" | "forbidden" | "age" | "error" | "unavailable" | null;

/**
 * Playback authorization: verifies title, rights window, region, profile ownership and age.
 * Test sources (is_test_source) are only returned to media managers (development mode); production sources always win.
 */
export const authorizePlayback = createServerFn({ method: "POST" })
  .inputValidator((d: { titleId: string; episodeId?: string; profileId?: string }) =>
    z.object({ titleId: z.string().uuid(), episodeId: z.string().uuid().optional(), profileId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { providerFor, rateLimit } = await import("./providers.server");
    const none = (reason: Reason) => ({ ok: false as const, reason, sources: [], devMode: false });
    if (!rateLimit(`auth:${ip()}`, 60, 60_000)) return none("rate_limited");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const auth = getRequestHeader("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    const { data: u } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } };
    const userId = u.user?.id ?? null;
    let devMode = false;
    if (userId) {
      const { data: can } = await supabaseAdmin.rpc("can_manage_media", { _user_id: userId });
      devMode = !!can;
    }

    if (data.profileId) {
      const { data: prof } = userId
        ? await supabaseAdmin.from("profiles").select("id, max_age").eq("id", data.profileId).eq("user_id", userId).maybeSingle()
        : { data: null };
      if (!prof) return none("forbidden");
      const { data: t } = await supabaseAdmin.from("titles").select("age_rating").eq("id", data.titleId).maybeSingle();
      if (t && t.age_rating > prof.max_age) return none("age");
    }
    const country = getRequestHeader("cf-ipcountry")?.toUpperCase() || null;
    const { data: rows, error } = await supabaseAdmin.rpc("playback_candidates", {
      _title: data.titleId, _episode: data.episodeId ?? undefined,
      _country: country && country !== "XX" ? country : undefined, _include_test: devMode,
    });
    if (error) { console.error("playback_candidates", error.message); return none("error"); }
    const list = rows ?? [];
    // Production content takes priority: once any real source exists, test sources are dropped.
    const usable = list.some((r) => !r.is_test_source) ? list.filter((r) => !r.is_test_source) : list;
    const sources = [];
    for (const r of usable) {
      try { sources.push(await providerFor(r.provider ?? "url").resolve(r as never)); }
      catch (e) { console.error("resolve failed", r.id, (e as Error).message); }
    }
    return sources.length ? { ok: true as const, reason: null, sources, devMode } : none("unavailable");
  });

export const reportPlaybackError = createServerFn({ method: "POST" })
  .inputValidator((d: { sourceId: string; message: string; provider?: string; device?: string }) =>
    z.object({ sourceId: z.string().uuid(), message: z.string().max(300), provider: z.string().max(40).optional(), device: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit } = await import("./providers.server");
    if (!rateLimit(`err:${ip()}`, 10, 60_000)) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("playback_errors").insert({
      source_id: data.sourceId, message: data.message, provider: data.provider ?? null,
      device: data.device ?? getRequestHeader("user-agent")?.slice(0, 300) ?? null,
    });
    return { ok: true };
  });

/** Public availability: which units of a title have real (non-test) sources. No URLs. */
export const fetchPlayable = createServerFn({ method: "GET" })
  .inputValidator((d: { titleId: string }) => z.object({ titleId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const { data: rows } = await publicDb().rpc("playable_units", { _title: data.titleId });
    const list = rows ?? [];
    return { whole: list.some((r) => r.episode_id == null), episodes: list.map((r) => r.episode_id).filter(Boolean) as string[], testOnly: false };
  });

/** Staff availability: includes test sources (development mode) and flags units that only have test video. */
export const fetchPlayableStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { titleId: string }) => z.object({ titleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.rpc("playable_units", { _title: data.titleId, _include_test: true });
    const list = rows ?? [];
    return {
      whole: list.some((r) => r.episode_id == null), episodes: list.map((r) => r.episode_id).filter(Boolean) as string[],
      testOnly: list.length > 0 && list.every((r) => r.test_only),
    };
  });

// ---------------- Admin ----------------
async function assertMedia(ctx: { supabase: unknown; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (ctx.supabase as any).rpc("can_manage_media", { _user_id: ctx.userId });
  if (!data) throw new Error("Forbidden");
}

export const providerConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMedia(context);
    const { muxProvider, cloudflareProvider } = await import("./providers.server");
    return {
      mux: muxProvider.configured(),
      muxSigned: !!(process.env.MUX_SIGNING_KEY_ID && process.env.MUX_SIGNING_PRIVATE_KEY),
      muxWebhook: !!process.env.MUX_WEBHOOK_SECRET,
      cloudflare: cloudflareProvider.configured(),
    };
  });

export const testMux = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMedia(context);
    const { testMuxConnection } = await import("./providers.server");
    return { status: await testMuxConnection() };
  });

const unit = z.object({ titleId: z.string().uuid(), episodeId: z.string().uuid().nullable().optional() });
const meta = z.object({
  language: z.string().max(10).nullable().optional(), audioLanguage: z.string().max(10).nullable().optional(),
  quality: z.string().max(10).nullable().optional(),
  isDubbed: z.boolean().optional(), isSubbed: z.boolean().optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional(),
  isTest: z.boolean().optional(),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250).nullable().optional(),
  availableFrom: z.string().datetime({ offset: true }).nullable().optional(),
  availableUntil: z.string().datetime({ offset: true }).nullable().optional(),
});
type Meta = z.infer<typeof meta>;
const metaRow = (d: Meta) => ({
  language: d.language ?? null, audio_language: d.audioLanguage ?? d.language ?? null, quality: d.quality ?? null,
  is_dubbed: d.isDubbed ?? false, is_subbed: d.isSubbed ?? false, is_default: d.isDefault ?? false,
  is_test_source: d.isTest ?? false, availability_country: d.countries ?? null,
  available_from: d.availableFrom ?? null, available_until: d.availableUntil ?? null,
});
const NOT_CONFIGURED = "Mux production credentials not configured";

export const createProviderUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(meta).extend({ provider: z.enum(["mux", "cloudflare"]), signed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { providerFor } = await import("./providers.server");
    const p = providerFor(data.provider);
    if (!p.configured() || !p.createUpload) throw new Error(data.provider === "mux" ? NOT_CONFIGURED : "Cloudflare Stream not configured");
    const origin = getRequestHeader("origin") ?? "*";
    const ticket = await p.createUpload({ signed: data.signed, origin });
    const { data: row, error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: data.provider, kind: "hls", url: "",
      upload_id: ticket.uploadId, provider_asset_id: data.provider === "cloudflare" ? ticket.uploadId : null,
      status: "uploading", is_active: false, requires_signed_token: data.signed, ...metaRow(data),
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { sourceId: row.id, uploadUrl: ticket.uploadUrl, method: ticket.method };
  });

export const attachProviderAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(meta).extend({
    provider: z.enum(["mux", "cloudflare"]), assetId: z.string().regex(/^[A-Za-z0-9]{8,80}$/), signed: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { providerFor } = await import("./providers.server");
    if (!providerFor(data.provider).configured()) throw new Error(data.provider === "mux" ? NOT_CONFIGURED : "Cloudflare Stream not configured");
    const { data: row, error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: data.provider, kind: "hls", url: "",
      provider_asset_id: data.assetId, status: "processing", is_active: false, requires_signed_token: data.signed, ...metaRow(data),
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { sourceId: row.id };
  });

/** Mux public playback ID without API credentials (e.g. Mux's official public test asset). */
export const attachMuxPlaybackId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(meta).extend({ playbackId: z.string().regex(/^[A-Za-z0-9]{10,80}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: "mux", kind: "hls", url: "",
      playback_id: data.playbackId, status: "ready", is_active: data.isActive ?? true, ...metaRow(data),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addUrlSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(meta).extend({ kind: z.enum(["hls", "dash", "mp4", "embed"]), url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { safeUrl } = await import("./providers.server");
    const url = safeUrl(data.url);
    if (!url) throw new Error("Only https:// URLs are accepted");
    const p = new URL(url).pathname.toLowerCase();
    if (data.kind === "hls" && !p.endsWith(".m3u8")) throw new Error("HLS URLs must end with .m3u8");
    if (data.kind === "dash" && !p.endsWith(".mpd")) throw new Error("DASH URLs must end with .mpd");
    if (data.kind === "mp4" && !/\.(mp4|m4v|webm)$/.test(p)) throw new Error("MP4 URLs must end with .mp4, .m4v or .webm");
    const { error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: data.kind === "embed" ? "embed" : "url", kind: data.kind, url,
      status: "ready", is_active: data.isActive ?? true, ...metaRow(data),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Polls the provider and stores asset/playback IDs once processing completes. */
export const refreshSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceId: string }) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { syncSource } = await import("./sync.server");
    return syncSource(context.supabase, data.sourceId);
  });

export const previewSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceId: string }) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { data: s, error } = await context.supabase.from("video_sources")
      .select("id, provider, kind, url, playback_id, provider_asset_id, requires_signed_token, language, audio_language, quality, is_dubbed, is_test_source").eq("id", data.sourceId).single();
    if (error) throw new Error(error.message);
    const { providerFor } = await import("./providers.server");
    return providerFor(s.provider ?? "url").resolve({ ...s, subtitles: [] } as never);
  });

// ---------------- Subtitles ----------------
const subMeta = z.object({
  lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/), label: z.string().min(1).max(60),
  forced: z.boolean().optional(), sdh: z.boolean().optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional(),
});

export const uploadSubtitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(subMeta).extend({
    filename: z.string().max(200), content: z.string().min(1).max(2_000_000), replaceId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { toWebVtt } = await import("./subtitles.server");
    const vtt = toWebVtt(data.content, data.filename);
    if (data.isDefault) {
      let q = context.supabase.from("subtitle_tracks").update({ is_default: false }).eq("title_id", data.titleId);
      q = data.episodeId ? q.eq("episode_id", data.episodeId) : q.is("episode_id", null);
      await q;
    }
    const row = {
      title_id: data.titleId, episode_id: data.episodeId ?? null, lang: data.lang, label: data.label,
      is_forced: data.forced ?? false, is_sdh: data.sdh ?? false, is_default: data.isDefault ?? false, is_active: data.isActive ?? true, vtt,
    };
    if (data.replaceId) {
      const { error } = await context.supabase.from("subtitle_tracks").update(row).eq("id", data.replaceId);
      if (error) throw new Error(error.message);
      return { id: data.replaceId };
    }
    const id = crypto.randomUUID();
    const { error } = await context.supabase.from("subtitle_tracks").insert({ ...row, id, url: `/api/public/subtitles/${id}` });
    if (error) throw new Error(error.message);
    return { id };
  });

// ---------------- Intro / recap / credits markers ----------------
const sec = z.number().int().min(0).max(24 * 3600).nullable();
export const saveMarkers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    titleId: z.string().uuid(), episodeId: z.string().uuid().nullable().optional(),
    introStart: sec, introEnd: sec, recapStart: sec.optional(), recapEnd: sec.optional(), creditsStart: sec,
  }).refine((m) => m.introStart == null || m.introEnd == null || m.introEnd > m.introStart, "Intro end must be after intro start")
    .refine((m) => m.recapStart == null || m.recapEnd == null || m.recapEnd > m.recapStart, "Recap end must be after recap start")
    .parse(d))
  .handler(async ({ data, context }) => {
    await assertMedia(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = data.episodeId
      ? await supabaseAdmin.from("episodes").update({
          intro_start_s: data.introStart, intro_end_s: data.introEnd, recap_start_s: data.recapStart ?? null,
          recap_end_s: data.recapEnd ?? null, credits_start_s: data.creditsStart,
        }).eq("id", data.episodeId)
      : await supabaseAdmin.from("titles").update({ intro_start_s: data.introStart, intro_end_s: data.introEnd, credits_start_s: data.creditsStart }).eq("id", data.titleId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ip = () => getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

/** Playback authorization: verifies title, rights, region, profile ownership; returns short-lived playable sources (best first). */
export const authorizePlayback = createServerFn({ method: "POST" })
  .inputValidator((d: { titleId: string; episodeId?: string; profileId?: string }) =>
    z.object({ titleId: z.string().uuid(), episodeId: z.string().uuid().optional(), profileId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { providerFor, rateLimit } = await import("./providers.server");
    if (!rateLimit(`auth:${ip()}`, 60, 60_000)) return { ok: false as const, reason: "rate_limited" as const, sources: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.profileId) {
      const auth = getRequestHeader("authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      const { data: u } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } };
      const { data: prof } = u.user
        ? await supabaseAdmin.from("profiles").select("id, max_age").eq("id", data.profileId).eq("user_id", u.user.id).maybeSingle()
        : { data: null };
      if (!prof) return { ok: false as const, reason: "forbidden" as const, sources: [] };
      const { data: t } = await supabaseAdmin.from("titles").select("age_rating").eq("id", data.titleId).maybeSingle();
      if (t && t.age_rating > prof.max_age) return { ok: false as const, reason: "forbidden" as const, sources: [] };
    }
    const country = getRequestHeader("cf-ipcountry")?.toUpperCase() || null;
    const { data: rows, error } = await supabaseAdmin.rpc("playback_candidates", {
      _title: data.titleId, _episode: data.episodeId ?? undefined, _country: country && country !== "XX" ? country : undefined,
    });
    if (error) { console.error("playback_candidates", error); return { ok: false as const, reason: "error" as const, sources: [] }; }
    const sources = [];
    for (const r of rows ?? []) {
      try { sources.push(await providerFor(r.provider ?? "url").resolve(r as never)); }
      catch (e) { console.error("resolve failed", r.id, e); }
    }
    return sources.length ? { ok: true as const, reason: null, sources } : { ok: false as const, reason: "unavailable" as const, sources: [] };
  });

export const reportPlaybackError = createServerFn({ method: "POST" })
  .inputValidator((d: { sourceId: string; message: string }) => z.object({ sourceId: z.string().uuid(), message: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit } = await import("./providers.server");
    if (!rateLimit(`err:${ip()}`, 10, 60_000)) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("playback_errors").insert({ source_id: data.sourceId, message: data.message });
    return { ok: true };
  });

/** Public availability: which units of a title can be played (no URLs). */
export const fetchPlayable = createServerFn({ method: "GET" })
  .inputValidator((d: { titleId: string }) => z.object({ titleId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { publicDb } = await import("@/features/catalog/catalog.server");
    const { data: rows } = await publicDb().rpc("playable_units", { _title: data.titleId });
    const list = rows ?? [];
    return { whole: list.some((r) => r.episode_id == null), episodes: list.map((r) => r.episode_id).filter(Boolean) as string[] };
  });

// ---------------- Admin ----------------
async function assertAdmin(ctx: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (ctx.supabase as any).rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const providerConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { muxProvider, cloudflareProvider } = await import("./providers.server");
    return {
      mux: muxProvider.configured(), muxSigned: !!(process.env.MUX_SIGNING_KEY_ID && process.env.MUX_SIGNING_PRIVATE_KEY),
      cloudflare: cloudflareProvider.configured(),
    };
  });

const unit = z.object({ titleId: z.string().uuid(), episodeId: z.string().uuid().nullable().optional() });
const meta = z.object({
  language: z.string().max(10).nullable().optional(), quality: z.string().max(10).nullable().optional(),
  isDubbed: z.boolean().optional(), isSubbed: z.boolean().optional(), isDefault: z.boolean().optional(),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250).nullable().optional(),
});

export const createProviderUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(meta).extend({ provider: z.enum(["mux", "cloudflare"]), signed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { providerFor } = await import("./providers.server");
    const p = providerFor(data.provider);
    if (!p.configured() || !p.createUpload) throw new Error(`${data.provider} is not configured`);
    const origin = getRequestHeader("origin") ?? "*";
    const ticket = await p.createUpload({ signed: data.signed, origin });
    const { data: row, error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: data.provider, kind: "hls", url: "",
      upload_id: ticket.uploadId, provider_asset_id: data.provider === "cloudflare" ? ticket.uploadId : null,
      status: "uploading", is_active: false, requires_signed_token: data.signed,
      language: data.language ?? null, quality: data.quality ?? null, is_dubbed: data.isDubbed ?? false, is_subbed: data.isSubbed ?? false,
      is_default: data.isDefault ?? false, availability_country: data.countries ?? null,
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
    await assertAdmin(context as never);
    const { data: row, error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: data.provider, kind: "hls", url: "",
      provider_asset_id: data.assetId, status: "processing", is_active: false, requires_signed_token: data.signed,
      language: data.language ?? null, quality: data.quality ?? null, is_dubbed: data.isDubbed ?? false, is_subbed: data.isSubbed ?? false,
      is_default: data.isDefault ?? false, availability_country: data.countries ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { sourceId: row.id };
  });

export const addUrlSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unit.merge(meta).extend({ kind: z.enum(["hls", "dash", "mp4", "embed"]), url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { safeUrl } = await import("./providers.server");
    const url = safeUrl(data.url);
    if (!url) throw new Error("Only https:// URLs are accepted");
    const p = new URL(url).pathname.toLowerCase();
    if (data.kind === "hls" && !p.endsWith(".m3u8")) throw new Error("HLS URLs must end with .m3u8");
    if (data.kind === "dash" && !p.endsWith(".mpd")) throw new Error("DASH URLs must end with .mpd");
    if (data.kind === "mp4" && !/\.(mp4|m4v|webm)$/.test(p)) throw new Error("MP4 URLs must end with .mp4, .m4v or .webm");
    const { error } = await context.supabase.from("video_sources").insert({
      title_id: data.titleId, episode_id: data.episodeId ?? null, provider: data.kind === "embed" ? "embed" : "url", kind: data.kind, url,
      status: "ready", is_active: true, language: data.language ?? null, quality: data.quality ?? null,
      is_dubbed: data.isDubbed ?? false, is_subbed: data.isSubbed ?? false, is_default: data.isDefault ?? false,
      availability_country: data.countries ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Polls the provider and stores asset/playback IDs once processing completes. */
export const refreshSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceId: string }) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { syncSource } = await import("./sync.server");
    return syncSource(context.supabase, data.sourceId);
  });

export const previewSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceId: string }) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: s, error } = await context.supabase.from("video_sources")
      .select("id, provider, kind, url, playback_id, provider_asset_id, requires_signed_token, language, quality, is_dubbed").eq("id", data.sourceId).single();
    if (error) throw new Error(error.message);
    const { providerFor } = await import("./providers.server");
    return providerFor(s.provider ?? "url").resolve({ ...s, subtitles: [] } as never);
  });

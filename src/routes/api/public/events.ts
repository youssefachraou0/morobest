import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * First-party analytics ingestion. Public by design (anonymous visitors send events), so it only accepts a
 * strict, size-limited schema, stores a hashed visitor id, and diverts crawler traffic to a separate SEO counter.
 */
const EVENTS = ["page_view", "impression", "click", "search", "search_click", "watch_click", "play_start", "pause", "resume", "watch_time", "complete", "playback_error", "fallback", "continue_click", "watchlist_add", "watchlist_remove", "favorite_add", "favorite_remove", "autoplay_next", "subtitle_select", "audio_select"] as const;
const uuid = z.string().uuid();
const Body = z.object({
  v: z.string().min(1).max(64),
  s: z.string().max(64).nullable().optional(),
  events: z.array(z.object({
    e: z.enum(EVENTS),
    t: z.number().int(),
    path: z.string().max(200),
    key: z.string().regex(/^(tmdb|anilist|mb):[a-z0-9:-]{1,80}$/).nullable().optional(),
    titleId: uuid.nullable().optional(),
    episodeId: uuid.nullable().optional(),
    ctx: z.string().max(40).nullable().optional(),
    value: z.number().min(0).max(86400).nullable().optional(),
    props: z.record(z.string().max(30), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).optional(),
  })).min(1).max(50),
});

const BOT = /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|applebot|facebookexternalhit|twitterbot|linkedinbot|ahrefs|semrush|mj12bot|petalbot|bytespider|gptbot|claudebot|ccbot|crawler|spider|bot\b|headlesschrome|lighthouse|pingdom|uptime|curl|wget|python-requests|httpclient)/i;
const botName = (ua: string) => ua.match(BOT)?.[1]?.toLowerCase() ?? "unknown";

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`morobest:${s}`));
  return Array.from(new Uint8Array(b).slice(0, 12), (x) => x.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 64_000) return new Response("too large", { status: 413 });
        let parsed;
        try { parsed = Body.parse(JSON.parse(raw)); } catch { return new Response("bad request", { status: 400 }); }
        const ua = request.headers.get("user-agent") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const day = new Date().toISOString().slice(0, 10);

        if (!ua || BOT.test(ua)) {
          // SEO crawler traffic: counted separately, never mixed with human viewing analytics.
          const pages = parsed.events.filter((e) => e.e === "page_view");
          const bot = ua ? botName(ua) : "no-ua";
          const sections = new Map<string, number>();
          for (const p of pages) { const sec = p.path.split("/")[1] || "home"; sections.set(sec, (sections.get(sec) ?? 0) + 1); }
          for (const [section, n] of sections) {
            const { data: cur } = await supabaseAdmin.from("crawler_hits").select("hits").match({ day, bot, section }).maybeSingle();
            await supabaseAdmin.from("crawler_hits").upsert({ day, bot, section, hits: (cur?.hits ?? 0) + n });
          }
          return new Response(null, { status: 204 });
        }

        const visitor = await sha(parsed.v);
        const now = Date.now();
        const rows = parsed.events.map((e) => ({
          // Client clocks are untrusted: clamp to the last hour.
          occurred_at: new Date(Math.min(now, Math.max(now - 3600_000, e.t))).toISOString(),
          event: e.e, visitor, session: parsed.s ? trimSession(parsed.s) : null,
          content_key: e.key ?? null, title_id: e.titleId ?? null, episode_id: e.episodeId ?? null,
          ctx: e.ctx ?? null, value: e.value ?? null, props: e.props ?? {}, path: e.path,
        }));
        const { error } = await supabaseAdmin.from("analytics_events").insert(rows);
        if (error) console.error("analytics insert failed", error.message);
        // Lightweight retention: roughly 1 in 200 batches rolls up daily stats and purges raw events older than 90 days.
        if (Math.random() < 0.005) supabaseAdmin.rpc("analytics_maintain").then(({ error: e }) => e && console.error("analytics maintain", e.message));
        return new Response(null, { status: 204 });
      },
    },
  },
});

/** Session ids are random per tab; trimmed rather than hashed since they carry no identity. */
function trimSession(s: string) { return s.slice(0, 36); }

import { z } from "zod";

/**
 * Strict analytics ingestion schema shared by the public endpoint and tests.
 * Only these events and these property keys are accepted; anything else rejects the batch.
 */
export const EVENTS = ["page_view", "impression", "click", "search", "search_click", "watch_click", "play_start", "pause", "resume", "watch_time", "complete", "playback_error", "fallback", "continue_click", "watchlist_add", "watchlist_remove", "favorite_add", "favorite_remove", "autoplay_next", "subtitle_select", "audio_select"] as const;
export type EventName = (typeof EVENTS)[number];

const uuid = z.string().uuid();
const lang = z.string().regex(/^(off|[a-z]{2,3}(-[A-Za-z0-9]{2,8})?)$/);
const short = (n: number) => z.string().max(n);

/** Allowed props per event. Unknown keys are rejected (strict). */
const PROPS: Partial<Record<EventName, z.ZodTypeAny>> = {
  search: z.object({ q: short(80), kind: short(20).nullable().optional() }).strict(),
  play_start: z.object({ provider: short(30).nullable().optional() }).strict(),
  playback_error: z.object({ provider: short(30).nullable().optional(), message: short(120).optional() }).strict(),
  fallback: z.object({ provider: short(30).nullable().optional() }).strict(),
  subtitle_select: z.object({ lang: lang.nullable() }).strict(),
  audio_select: z.object({ lang: lang.nullable() }).strict(),
  watch_click: z.object({ slug: short(120).nullable().optional() }).strict(),
};
const NO_PROPS = z.object({}).strict();
const PLAYBACK: EventName[] = ["play_start", "pause", "resume", "watch_time", "complete", "playback_error", "fallback", "autoplay_next", "subtitle_select", "audio_select"];

export const EventSchema = z.object({
  e: z.enum(EVENTS),
  t: z.number().int().positive(),
  path: z.string().max(200).regex(/^\//),
  key: z.string().regex(/^(tmdb|anilist|mb):[a-z0-9:-]{1,80}$/).nullable().optional(),
  titleId: uuid.nullable().optional(),
  episodeId: uuid.nullable().optional(),
  ctx: z.string().regex(/^[a-z0-9_-]{1,40}$/).nullable().optional(),
  value: z.number().min(0).max(86400).nullable().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  test: z.boolean().optional(),
}).strict().superRefine((ev, c) => {
  const ps = (PROPS[ev.e] ?? NO_PROPS).safeParse(ev.props ?? {});
  if (!ps.success) c.addIssue({ code: "custom", message: `invalid props for ${ev.e}` });
  if (PLAYBACK.includes(ev.e) && !ev.titleId) c.addIssue({ code: "custom", message: "playback events need titleId" });
  if (ev.e === "watch_time" && !(ev.value != null && ev.value >= 1 && ev.value <= 60)) c.addIssue({ code: "custom", message: "watch_time must be 1..60s" });
  if (ev.episodeId && !ev.titleId) c.addIssue({ code: "custom", message: "episodeId requires titleId" });
});
export type IngestEvent = z.infer<typeof EventSchema>;

export const BatchSchema = z.object({
  v: z.string().min(8).max(64),
  s: z.string().max(64).nullable().optional(),
  qa: z.boolean().optional(),
  events: z.array(EventSchema).min(1).max(50),
}).strict();
export type Batch = z.infer<typeof BatchSchema>;

const BOT = /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|applebot|facebookexternalhit|twitterbot|linkedinbot|ahrefs|semrush|mj12bot|petalbot|bytespider|gptbot|claudebot|ccbot|crawler|spider|bot\b|headlesschrome|lighthouse|pingdom|uptime|curl|wget|python-requests|httpclient)/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);
export const botName = (ua: string) => (ua ? ua.match(BOT)?.[1]?.toLowerCase() ?? "unknown" : "no-ua");

/** Test/internal traffic: staff QA mode, test videos or automated tests flagged by the client. */
export const isTestBatch = (b: Batch) => !!b.qa || b.events.some((e) => e.test);

/** Server-side clock clamp: client timestamps are untrusted, kept within the last hour. */
export const clampTime = (t: number, now: number) => Math.min(now, Math.max(now - 3600_000, t));

export async function hashVisitor(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`morobest:${v}`));
  return Array.from(new Uint8Array(b).slice(0, 12), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Maps a validated batch to database rows — only whitelisted columns ever reach the insert. */
export function toRows(b: Batch, visitor: string, now: number) {
  const test = isTestBatch(b);
  return b.events.map((e) => ({
    occurred_at: new Date(clampTime(e.t, now)).toISOString(),
    event: e.e, visitor, session: b.s ? b.s.slice(0, 36) : null,
    content_key: e.key ?? null, title_id: e.titleId ?? null, episode_id: e.episodeId ?? null,
    ctx: e.ctx ?? null, value: e.value ?? null,
    props: (e.e === "search" && e.props ? { ...e.props, q: String(e.props.q ?? "").trim().toLowerCase().slice(0, 80) } : e.props ?? {}) as Record<string, string | number | boolean | null>,
    path: e.path, is_test: test,
  }));
}

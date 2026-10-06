import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BatchSchema, EventSchema, clampTime, hashVisitor, isBot, isTestBatch, toRows } from "@/features/analytics/schema";
import { computeMetrics, dropOff, rate, watchStep, type Ev } from "@/features/analytics/metrics";
import { getCanonicalContentUrl, canonicalHref, contentKey } from "@/features/editorial/canonical";
import { hm, pct } from "@/components/mb/AnalyticsBits";

const T = "11111111-1111-4111-8111-111111111111";
const E1 = "22222222-2222-4222-8222-222222222222";
const E2 = "33333333-3333-4333-8333-333333333333";
const now = Date.now();
const ev = (e: string, extra: Record<string, unknown> = {}) => ({ e, t: now, path: "/watch/x", titleId: T, ...extra });
const batch = (events: unknown[], extra: Record<string, unknown> = {}) => ({ v: "visitor-abcdef", s: "sess-1", events, ...extra });

describe("event validation", () => {
  it("accepts a valid playback batch", () => {
    expect(BatchSchema.safeParse(batch([ev("play_start", { props: { provider: "mux" } }), ev("watch_time", { value: 30 })])).success).toBe(true);
  });
  it("rejects unknown events", () => expect(EventSchema.safeParse(ev("hack")).success).toBe(false));
  it("rejects arbitrary database fields", () => {
    expect(EventSchema.safeParse({ ...ev("click"), is_test: false }).success).toBe(false);
    expect(BatchSchema.safeParse({ ...batch([ev("click")]), visitor: "x" }).success).toBe(false);
  });
  it("rejects unknown props keys", () => expect(EventSchema.safeParse(ev("play_start", { props: { url: "https://secret" } })).success).toBe(false));
  it("rejects malformed ids", () => expect(EventSchema.safeParse(ev("play_start", { titleId: "1; drop table" })).success).toBe(false));
  it("requires titleId for playback events", () => expect(EventSchema.safeParse({ e: "play_start", t: now, path: "/" }).success).toBe(false));
  it("requires titleId when episodeId is sent", () => expect(EventSchema.safeParse({ e: "click", t: now, path: "/", episodeId: E1 }).success).toBe(false));
  it("bounds watch_time heartbeats to 1..60s", () => {
    expect(EventSchema.safeParse(ev("watch_time", { value: 30 })).success).toBe(true);
    expect(EventSchema.safeParse(ev("watch_time", { value: 3600 })).success).toBe(false);
    expect(EventSchema.safeParse(ev("watch_time", { value: 0 })).success).toBe(false);
  });
  it("validates language values", () => {
    expect(EventSchema.safeParse(ev("subtitle_select", { props: { lang: "ar" } })).success).toBe(true);
    expect(EventSchema.safeParse(ev("subtitle_select", { props: { lang: "off" } })).success).toBe(true);
    expect(EventSchema.safeParse(ev("audio_select", { props: { lang: "<script>" } })).success).toBe(false);
  });
  it("validates content keys and paths", () => {
    expect(EventSchema.safeParse({ e: "click", t: now, path: "/", key: "tmdb:movie:550" }).success).toBe(true);
    expect(EventSchema.safeParse({ e: "click", t: now, path: "/", key: "evil:1" }).success).toBe(false);
    expect(EventSchema.safeParse({ e: "click", t: now, path: "https://x" }).success).toBe(false);
  });
  it("caps batch size", () => expect(BatchSchema.safeParse(batch(Array.from({ length: 51 }, () => ev("pause")))).success).toBe(false));
  it("clamps untrusted client timestamps", () => {
    expect(clampTime(now + 1e7, now)).toBe(now);
    expect(clampTime(0, now)).toBe(now - 3600_000);
  });
});

describe("privacy", () => {
  it("lowercases and truncates search terms", () => {
    const b = BatchSchema.parse(batch([{ e: "search", t: now, path: "/search", props: { q: "  FIGHT Club" } }]));
    expect(toRows(b, "h", now)[0]!.props).toEqual({ q: "fight club" });
    expect(BatchSchema.safeParse(batch([{ e: "search", t: now, path: "/search", props: { q: "x".repeat(81) } }])).success).toBe(false);
  });
  it("stores only whitelisted columns (no IP / user agent / raw visitor id)", () => {
    const row = toRows(BatchSchema.parse(batch([ev("play_start")])), "hashed", now)[0]!;
    expect(Object.keys(row).sort()).toEqual(["content_key", "ctx", "episode_id", "event", "is_test", "occurred_at", "path", "props", "session", "title_id", "value", "visitor"].sort());
    expect(row.visitor).toBe("hashed");
  });
  it("hashes visitor ids irreversibly and deterministically", async () => {
    const a = await hashVisitor("visitor-abcdef");
    expect(a).toHaveLength(24);
    expect(a).toBe(await hashVisitor("visitor-abcdef"));
    expect(a).not.toContain("visitor");
  });
});

describe("test traffic", () => {
  it("marks QA batches and test-video events as test", () => {
    expect(isTestBatch(BatchSchema.parse(batch([ev("pause")], { qa: true })))).toBe(true);
    expect(isTestBatch(BatchSchema.parse(batch([ev("pause", { test: true })])))).toBe(true);
    expect(isTestBatch(BatchSchema.parse(batch([ev("pause")])))).toBe(false);
    expect(toRows(BatchSchema.parse(batch([ev("pause")], { qa: true })), "h", now)[0]!.is_test).toBe(true);
  });
  it("excludes test events from metrics unless requested", () => {
    const evs: Ev[] = [
      { event: "play_start", visitor: "a", session: "1", titleId: T },
      { event: "play_start", visitor: "qa", session: "1", titleId: T, isTest: true },
    ];
    expect(computeMetrics(evs).views).toBe(1);
    expect(computeMetrics(evs, { includeTest: true }).views).toBe(2);
  });
  it("classifies crawlers and headless browsers as bots", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (Macintosh) Safari/605")).toBe(false);
  });
});

describe("watch-time accumulation", () => {
  const run = (steps: [number, { paused?: boolean; hidden?: boolean }?][]) => {
    let last = 0, acc = 0;
    for (const [t, s] of steps) { acc += watchStep(last, t, { paused: !!s?.paused, hidden: !!s?.hidden }); last = t; }
    return acc;
  };
  it("counts continuous playback", () => expect(run(Array.from({ length: 360 }, (_, i) => [(i + 1) * 0.25] as [number]))).toBeCloseTo(90));
  it("ignores seek jumps", () => expect(run([[0.25], [0.5], [300], [300.25]])).toBeCloseTo(0.75));
  it("ignores backward seeks", () => expect(run([[10], [2]])).toBe(0));
  it("ignores paused time", () => expect(run([[0.25], [0.5, { paused: true }], [0.75, { paused: true }]])).toBeCloseTo(0.25));
  it("ignores hidden/background tab time", () => expect(run([[0.25], [0.5, { hidden: true }]])).toBeCloseTo(0.25));
});

describe("metrics math (controlled session)", () => {
  // One viewer: refreshes twice (same session), source fails once then fallback succeeds, 3 × 30s heartbeats + 12s, completion fired twice.
  const s: Ev[] = [
    { event: "playback_error", visitor: "v1", session: "s1", titleId: T },
    { event: "play_start", visitor: "v1", session: "s1", titleId: T },
    { event: "play_start", visitor: "v1", session: "s1", titleId: T },
    { event: "play_start", visitor: "v1", session: "s1", titleId: T },
    ...[30, 30, 30, 12].map((value) => ({ event: "watch_time", visitor: "v1", session: "s1", titleId: T, value })),
    { event: "complete", visitor: "v1", session: "s1", titleId: T },
    { event: "complete", visitor: "v1", session: "s1", titleId: T },
    // A second viewer whose only source fails completely.
    { event: "playback_error", visitor: "v2", session: "s9", titleId: T },
  ];
  const m = computeMetrics(s);
  it("does not double-count playback starts on refresh", () => expect(m.views).toBe(1));
  it("counts unique viewers", () => expect(m.uniqueViewers).toBe(1));
  it("sums watch time once per heartbeat", () => expect(m.watchSeconds).toBe(102));
  it("computes average watch time", () => expect(m.avgWatchSeconds).toBe(102));
  it("does not double-count completion", () => { expect(m.completions).toBe(1); expect(m.completionRate).toBe(1); });
  it("successful fallback is not a failure; total failure is", () => { expect(m.attempts).toBe(2); expect(m.failed).toBe(1); expect(m.failureRate).toBe(0.5); });
  it("rate never exceeds 100% or divides by zero", () => { expect(rate(5, 2)).toBe(1); expect(rate(1, 0)).toBe(0); });
});

describe("series / episode analytics", () => {
  const evs: Ev[] = [];
  for (let i = 0; i < 100; i++) evs.push({ event: "play_start", visitor: `v${i}`, session: "s", titleId: T, episodeId: E1 });
  for (let i = 0; i < 70; i++) evs.push({ event: "play_start", visitor: `v${i}`, session: "s", titleId: T, episodeId: E2 }, { event: "complete", visitor: `v${i}`, session: "s", titleId: T, episodeId: E2 });
  const ep = (id: string) => computeMetrics(evs.filter((e) => e.episodeId === id));
  it("counts views per episode", () => { expect(ep(E1).views).toBe(100); expect(ep(E2).views).toBe(70); });
  it("counts completion per episode", () => { expect(ep(E1).completionRate).toBe(0); expect(ep(E2).completionRate).toBe(1); });
  it("drop-off: 100 → 70 viewers is 30%", () => expect(dropOff([100, 70])).toEqual([0, 0.30000000000000004].map((x) => x)));
  it("drop-off never goes negative", () => expect(dropOff([10, 20])[1]).toBe(0));
  it("same viewer on two episodes is two views but one unique viewer", () => {
    const m = computeMetrics([
      { event: "play_start", visitor: "a", session: "s", titleId: T, episodeId: E1 },
      { event: "play_start", visitor: "a", session: "s", titleId: T, episodeId: E2 },
    ]);
    expect(m.views).toBe(2); expect(m.uniqueViewers).toBe(1);
  });
});

describe("canonical URLs", () => {
  const slugs = { "movie:550": "fight-club", "title:caravan": "series|1396" };
  it("uses the custom slug when one exists", () => expect(getCanonicalContentUrl({ kind: "movie", providerId: 550, slug: "fight-club-550" }, slugs)).toEqual({ to: "/movie/$slug", params: { slug: "fight-club" } }));
  it("falls back to the stable provider slug", () => expect(canonicalHref(getCanonicalContentUrl({ kind: "series", providerId: 1, slug: "x-1" }, slugs))).toBe("/tv/x-1"));
  it("links provider-linked MOROBEST titles straight to the provider page", () => expect(canonicalHref(getCanonicalContentUrl({ kind: "title", slug: "caravan" }, slugs))).toBe("/tv/caravan-1396"));
  it("keeps unlinked MOROBEST titles on /title", () => expect(canonicalHref(getCanonicalContentUrl({ kind: "title", slug: "solo" }, slugs))).toBe("/title/solo"));
  it("builds analytics content keys", () => { expect(contentKey("anime", 5)).toBe("anilist:anime:5"); expect(contentKey("series", 5)).toBe("tmdb:series:5"); });
});

describe("dashboard formatting", () => {
  it("never renders NaN", () => { expect(hm(Number.NaN)).toBe("0m"); expect(pct(1, 0)).toBe("—"); expect(pct(Number.NaN, 3)).toBe("—"); });
  it("caps percentages at 100%", () => expect(pct(5, 3)).toBe("100%"));
  it("formats hours", () => expect(hm(5400)).toBe("1h 30m"));
});

describe("database guarantees (migration)", () => {
  const sql = readFileSync("drizzle/migrations/0010_analytics_test_traffic_and_math.sql", "utf8");
  it("staff-only dashboard and title analytics", () => {
    expect(sql).toMatch(/analytics_dashboard[\s\S]*?IF NOT public\.is_staff\(auth\.uid\(\)\) THEN RAISE EXCEPTION 'forbidden'/);
    expect(sql).toMatch(/analytics_title[\s\S]*?IF NOT public\.is_staff\(auth\.uid\(\)\)/);
  });
  it("admin-only maintenance", () => expect(sql.match(/IF NOT public\.is_analytics_admin\(auth\.uid\(\)\)/g)?.length).toBe(2));
  it("trending and rollups exclude test traffic", () => {
    expect(sql).toMatch(/trending_content[\s\S]*?where not e\.is_test/);
    expect(sql).toMatch(/analytics_rollup[\s\S]*?where not e\.is_test/);
  });
  it("trending gives one signal per visitor per day with recency decay", () => {
    expect(sql).toMatch(/group by k, d, visitor/);
    expect(sql).toMatch(/exp\(-\(current_date - d\)/);
  });
  it("retention: 90-day raw events, throttled opportunistic run", () => {
    expect(sql).toMatch(/interval '90 days'/);
    expect(sql).toMatch(/interval '6 hours'/);
  });
  it("redacts URLs from playback error messages", () => expect(sql).toMatch(/regexp_replace\(pe\.message, 'https\?/));
});

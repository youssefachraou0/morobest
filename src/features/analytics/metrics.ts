/**
 * Reference implementation of MOROBEST viewing metrics. The SQL functions (analytics_dashboard / analytics_title)
 * implement exactly these definitions; tests pin them down.
 *
 * - view            = distinct (visitor, title, episode, session) with a play_start (refresh keeps the session → no extra view)
 * - unique viewers  = distinct visitors with a play_start
 * - watch time      = sum of watch_time heartbeats
 * - avg watch time  = watch time / views
 * - completion rate = completed attempts / views (attempt counted once even if "complete" fires twice)
 * - failure rate    = attempts that errored and never started / all attempts (successful fallback ≠ failure)
 * - drop-off (ep n) = 1 − uniqueViewers(n) / uniqueViewers(first episode)
 */
export type Ev = { event: string; visitor: string; session: string | null; titleId: string | null; episodeId?: string | null; value?: number | null; isTest?: boolean };

export function computeMetrics(events: Ev[], opts: { includeTest?: boolean } = {}) {
  const evs = events.filter((e) => e.titleId && (opts.includeTest || !e.isTest));
  const att = new Map<string, { visitor: string; started: boolean; errored: boolean; completed: boolean }>();
  let watch = 0;
  for (const e of evs) {
    if (e.event === "watch_time") watch += e.value ?? 0;
    if (!["play_start", "playback_error", "complete"].includes(e.event)) continue;
    const k = [e.visitor, e.titleId, e.episodeId ?? "", e.session ?? ""].join("|");
    const a = att.get(k) ?? { visitor: e.visitor, started: false, errored: false, completed: false };
    if (e.event === "play_start") a.started = true;
    if (e.event === "playback_error") a.errored = true;
    if (e.event === "complete") a.completed = true;
    att.set(k, a);
  }
  const all = [...att.values()];
  const views = all.filter((a) => a.started).length;
  const completions = all.filter((a) => a.started && a.completed).length;
  const attempts = all.filter((a) => a.started || a.errored).length;
  const failed = all.filter((a) => a.errored && !a.started).length;
  return {
    views, uniqueViewers: new Set(all.filter((a) => a.started).map((a) => a.visitor)).size,
    watchSeconds: watch, avgWatchSeconds: views ? watch / views : 0,
    completions, completionRate: rate(completions, views), attempts, failed, failureRate: rate(failed, attempts),
  };
}

export const rate = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : 0);

/** Drop-off of each episode relative to the first episode's unique viewers. */
export const dropOff = (uniques: number[]) => uniques.map((u) => (uniques[0] ? Math.max(0, 1 - u / uniques[0]) : 0));

/**
 * Client-side watched-seconds accumulator. Counts only forward, small, unpaused, visible playback steps —
 * so seeks, pauses and background tabs never add watch time.
 */
export function watchStep(prev: number, cur: number, state: { paused: boolean; hidden: boolean }) {
  const d = cur - prev;
  return d > 0 && d < 2 && !state.paused && !state.hidden ? d : 0;
}

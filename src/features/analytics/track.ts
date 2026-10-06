import { useEffect, useRef } from "react";

/**
 * First-party, privacy-conscious analytics. Events are queued in memory and sent in batches
 * (every few seconds, and via sendBeacon when the tab hides) so UI and playback never wait on writes.
 * Only a random per-browser id is sent — no account, email or profile data.
 */
export type AnalyticsEvent =
  | "page_view" | "impression" | "click" | "search" | "search_click" | "watch_click"
  | "play_start" | "pause" | "resume" | "watch_time" | "complete" | "playback_error" | "fallback"
  | "continue_click" | "watchlist_add" | "watchlist_remove" | "favorite_add" | "favorite_remove"
  | "autoplay_next" | "subtitle_select" | "audio_select";
export type TrackFields = {
  key?: string | null; titleId?: string | null; episodeId?: string | null; ctx?: string | null; value?: number | null;
  props?: Record<string, string | number | boolean | null>;
};
type Queued = TrackFields & { e: AnalyticsEvent; t: number; path: string };

const ENDPOINT = "/api/public/events";
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let bound = false;

function ids() {
  try {
    let v = localStorage.getItem("mb_vid");
    if (!v) { v = crypto.randomUUID(); localStorage.setItem("mb_vid", v); }
    let s = sessionStorage.getItem("mb_sid");
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem("mb_sid", s); }
    return { v, s };
  } catch { return { v: "anon", s: null }; }
}

function flush(useBeacon = false) {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  const body = JSON.stringify({ ...ids(), events: batch });
  try {
    if (useBeacon && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    else fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch { /* analytics must never break the app */ }
  if (queue.length) schedule();
}
function schedule() { if (!timer) timer = setTimeout(() => flush(), 4000); }

export function track(e: AnalyticsEvent, f: TrackFields = {}) {
  if (typeof window === "undefined") return;
  if (!bound) {
    bound = true;
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
    window.addEventListener("pagehide", () => flush(true));
  }
  queue.push({ e, t: Date.now(), path: location.pathname.slice(0, 200), ...f });
  if (queue.length >= 40) flush(); else schedule();
}

/** One impression per element per page view, using a shared IntersectionObserver. */
const seen = new Set<string>();
let io: IntersectionObserver | null = null;
const meta = new WeakMap<Element, () => void>();
export function resetImpressions() { seen.clear(); }
export function useImpression<T extends Element>(id: string | null, fire: () => void) {
  const ref = useRef<T>(null);
  const fireRef = useRef(fire);
  fireRef.current = fire;
  useEffect(() => {
    const el = ref.current;
    if (!el || !id || typeof IntersectionObserver === "undefined") return;
    if (!io) io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting && en.intersectionRatio >= 0.5) { meta.get(en.target)?.(); io!.unobserve(en.target); }
    }, { threshold: 0.5 });
    meta.set(el, () => { if (seen.has(id)) return; seen.add(id); fireRef.current(); });
    io.observe(el);
    return () => { io?.unobserve(el); };
  }, [id]);
  return ref;
}

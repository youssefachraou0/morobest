import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, PictureInPicture2, RotateCcw, RotateCw, SkipForward, SkipBack, Volume2, VolumeX, Settings } from "lucide-react";
import { Star8 } from "@/components/mb/Brand";
import { cn } from "@/lib/utils";
import { track as trackEvent } from "@/features/analytics/track";
import { watchStep } from "@/features/analytics/metrics";

export type PlayerSource = { kind: string; url: string; subtitles: { lang: string; label: string; url: string; forced?: boolean; default?: boolean }[] };

type Props = {
  source: PlayerSource;
  title: string;
  startAt?: number;
  onProgress?: (pos: number, dur: number) => void;
  onEnded?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  errorLabel: string;
  /** Shown when the browser cannot decode the stream. */
  unsupportedLabel?: string;
  retryLabel: string;
  onPrev?: () => void;
  /** Return true when the caller handled the failure (e.g. switched to a fallback source). */
  onFatal?: (message: string) => boolean;
  markers?: { introStart?: number | null; introEnd?: number | null; recapStart?: number | null; recapEnd?: number | null; creditsStart?: number | null };
  audioOptions?: [string, string][];
  audio?: string;
  onAudio?: (v: string) => void;
  /** Auto-start the next episode after the countdown (viewer preference). */
  autoplayNext?: boolean;
  /** Preferred audio language for in-stream (multi-audio HLS) tracks. */
  preferredAudio?: string | null;
  onAudioLanguage?: (lang: string) => void;
  preferredSubtitle?: string | null;
  badge?: string;
  /** First-party analytics identity for this playback (title + episode). */
  analytics?: { titleId: string; episodeId?: string | null; provider?: string | null; test?: boolean };
};

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(sec).padStart(2, "0")}`;
};

/** Provider-agnostic player: HLS via hls.js (or native), MP4 direct. DASH/embeds plug in by `kind`. */
export function Player({ source, title, startAt = 0, onProgress, onEnded, onNext, nextLabel, errorLabel, unsupportedLabel, retryLabel, onPrev, onFatal, markers, audioOptions, audio, onAudio, autoplayNext = true, preferredAudio, onAudioLanguage, preferredSubtitle, badge, analytics }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [full, setFull] = useState(false);
  const [rate, setRate] = useState(1);
  const [levels, setLevels] = useState<{ height: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const initialSub = () => {
    const subs = source.subtitles;
    const pref = preferredSubtitle ? subs.findIndex((x) => x.lang === preferredSubtitle && !x.forced) : -1;
    if (pref >= 0) return pref;
    const def = subs.findIndex((x) => x.default);
    if (def >= 0) return def;
    return subs.findIndex((x) => x.forced);
  };
  const [subIdx, setSubIdx] = useState(initialSub);
  const [tracks, setTracks] = useState<{ id: number; lang: string; name: string }[]>([]);
  const [track, setTrack] = useState(-1);
  const [creditsDismissed, setCreditsDismissed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const startedRef = useRef(false);
  const attemptRef = useRef(0);
  const unsupportedAt = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [idle, setIdle] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const retries = useRef(0);
  const fatalRef = useRef(onFatal);
  fatalRef.current = onFatal;
  // Analytics: start/pause/resume, real watched seconds (heartbeat every 30s), completion once.
  const an = useRef(analytics); an.current = analytics;
  useEffect(() => {
    const v = video.current; const a = an.current;
    if (!v || !a) return;
    const f = { titleId: a.titleId, episodeId: a.episodeId ?? null, ...(a.test ? { test: true } : {}) };
    let started = false, done = false, paused = false, last = v.currentTime, acc = 0;
    const flush = () => { if (acc >= 1) { trackEvent("watch_time", { ...f, value: Math.round(acc) }); acc = 0; } };
    const onPlay = () => { if (!started) { started = true; trackEvent("play_start", { ...f, props: { provider: a.provider ?? null } }); } else if (paused) { paused = false; trackEvent("resume", f); } };
    const onSeek = () => { last = v.currentTime; };
    const onPause = () => { if (!v.ended && !paused) { paused = true; trackEvent("pause", f); } flush(); };
    const onTime = () => {
      acc += watchStep(last, v.currentTime, { paused: v.paused, hidden: document.visibilityState === "hidden" }); last = v.currentTime;
      if (acc >= 30) flush();
      if (!done && v.duration > 0 && v.currentTime / v.duration >= 0.9) { done = true; trackEvent("complete", { ...f, value: Math.round(v.duration) }); }
    };
    const onEnd = () => { flush(); if (!done) { done = true; trackEvent("complete", { ...f, value: Math.round(v.duration || 0) }); } };
    v.addEventListener("play", onPlay); v.addEventListener("pause", onPause); v.addEventListener("timeupdate", onTime); v.addEventListener("ended", onEnd); v.addEventListener("seeked", onSeek);
    return () => { flush(); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnd); v.removeEventListener("seeked", onSeek); };
  }, [source.url]);
  const fail = useCallback((m: string) => {
    startedRef.current = true; // settles the startup watchdog
    setLoading(false);
    if (fatalRef.current?.(m)) return;
    const unsup = m.startsWith("unsupported");
    if (unsup) unsupportedAt.current = attemptRef.current;
    setUnsupported(unsup);
    setError(true);
  }, []);
  useEffect(() => {
    if (countdown == null) return;
    if (!autoplayNext) return;
    if (countdown <= 0) { setCountdown(null); if (an.current) trackEvent("autoplay_next", { titleId: an.current.titleId, episodeId: an.current.episodeId ?? null, ...(an.current.test ? { test: true } : {}) }); onNext?.(); return; }
    const id = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, onNext, autoplayNext]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    attemptRef.current = attempt;
    // A refreshed token URL must not silently re-run a stream this browser already can't decode.
    if (unsupportedAt.current === attempt) return;
    let destroyed = false;
    setError(false);
    setUnsupported(false);
    setLoading(true);
    startedRef.current = false;
    // Never spin forever: if "playing" isn't reached within 15s, inspect and fail (or stop the spinner when autoplay was merely blocked).
    const startTimer = setTimeout(() => {
      if (destroyed || startedRef.current) return;
      const me = v.error;
      if (me) return fail(me.code === 4 ? `unsupported: media error ${me.code}` : `media error ${me.code}`);
      if (v.readyState >= 3) { setLoading(false); return; }
      fail(`start timeout (readyState ${v.readyState}, networkState ${v.networkState})`);
    }, 15_000);
    const avc = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';
    const start = () => { if (startAt > 0 && startAt < (v.duration || Infinity) - 5) v.currentTime = startAt; v.play().catch(() => {}); };
    if (source.kind === "hls" && !v.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) return fail("unsupported: HLS/MSE not available");
        const MS = (window as unknown as { MediaSource?: { isTypeSupported(t: string): boolean } }).MediaSource;
        if (MS && !MS.isTypeSupported(avc)) return fail("unsupported: H.264/AAC not decodable");
        const hls = new Hls({ capLevelToPlayerSize: true });
        hlsRef.current = hls;
        hls.loadSource(source.url);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => { setLevels(d.levels.map((l) => ({ height: l.height }))); start(); });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, d) => {
          const list = d.audioTracks.map((a, i) => ({ id: i, lang: a.lang ?? "", name: a.name || a.lang || `Track ${i + 1}` }));
          setTracks(list);
          const want = preferredAudio ? list.findIndex((a) => a.lang?.toLowerCase().startsWith(preferredAudio.toLowerCase())) : -1;
          if (want >= 0) hls.audioTrack = want;
          setTrack(hls.audioTrack);
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, d) => setTrack(d.id));
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          retries.current++;
          if (String(d.details).includes("IncompatibleCodecs")) return fail(`unsupported: hls ${d.details}`);
          if (retries.current > 2) return fail(`hls: ${d.details}`);
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else fail(`hls: ${d.details}`);
        });
      }).catch(() => fail("hls load failed"));
    } else if (source.kind === "dash") {
      import("dashjs").then((dashjs) => {
        if (destroyed) return;
        const pl = dashjs.MediaPlayer().create();
        hlsRef.current = { destroy: () => pl.reset() };
        pl.initialize(v, source.url, false);
        pl.on(dashjs.MediaPlayer.events.ERROR, () => fail("dash error"));
        v.addEventListener("loadedmetadata", start, { once: true });
      }).catch(() => fail("dash load failed"));
    } else {
      v.src = source.url;
      v.addEventListener("loadedmetadata", start, { once: true });
    }
    return () => { destroyed = true; clearTimeout(startTimer); hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [source.url, source.kind, startAt, attempt]);

  // Mid-playback stall watchdog: buffering for 25s without recovering becomes a real error.
  useEffect(() => {
    const v = video.current; if (!v) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { clearTimeout(t); t = setTimeout(() => { if (!v.paused && v.readyState < 3) fail(`stalled (readyState ${v.readyState})`); }, 25_000); };
    const clear = () => clearTimeout(t);
    const onErr = () => { const me = v.error; if (me && (source.kind === "hls" || source.kind === "dash") && me.code === 4) fail(`unsupported: media error ${me.code}`); };
    v.addEventListener("waiting", arm); v.addEventListener("stalled", arm);
    v.addEventListener("playing", clear); v.addEventListener("emptied", clear); v.addEventListener("abort", clear); v.addEventListener("error", onErr);
    return () => { clear(); v.removeEventListener("waiting", arm); v.removeEventListener("stalled", arm); v.removeEventListener("playing", clear); v.removeEventListener("emptied", clear); v.removeEventListener("abort", clear); v.removeEventListener("error", onErr); };
  }, [source.url, source.kind, fail]);

  // periodic progress save
  useEffect(() => {
    const id = setInterval(() => {
      const v = video.current;
      if (v && !v.paused && v.duration) onProgress?.(v.currentTime, v.duration);
    }, 10_000);
    return () => clearInterval(id);
  }, [onProgress]);

  const toggle = useCallback(() => { const v = video.current; if (!v) return; v.paused ? v.play() : v.pause(); }, []);
  const seek = useCallback((d: number) => { const v = video.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + d)); }, []);
  const toggleFull = useCallback(() => { document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
      const v = video.current; if (!v) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); toggle(); break;
        case "ArrowRight": case "l": seek(10); break;
        case "ArrowLeft": case "j": seek(-10); break;
        case "ArrowUp": e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break;
        case "ArrowDown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break;
        case "m": v.muted = !v.muted; break;
        case "f": toggleFull(); break;
        case "n": onNext?.(); break;
      }
    };
    const onFs = () => setFull(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [toggle, seek, toggleFull, onNext]);

  useEffect(() => {
    if (!playing) return setIdle(false);
    let to: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(to); to = setTimeout(() => setIdle(true), 2800); };
    wake();
    const el = wrap.current;
    el?.addEventListener("pointermove", wake);
    return () => { clearTimeout(to); el?.removeEventListener("pointermove", wake); };
  }, [playing]);

  useEffect(() => {
    const v = video.current; if (!v) return;
    Array.from(v.textTracks).forEach((tt, i) => { tt.mode = i === subIdx ? "showing" : "disabled"; });
  }, [subIdx, loading]);

  const m = markers ?? {};
  const showSkipIntro = m.introEnd != null && time >= (m.introStart ?? 0) && time < m.introEnd;
  const showSkipRecap = !showSkipIntro && m.recapEnd != null && time >= (m.recapStart ?? 0) && time < m.recapEnd;
  const inCredits = m.creditsStart != null && time >= m.creditsStart && dur > 0 && time < dur - 0.5;
  const nearEnd = m.creditsStart == null && dur > 0 && dur - time < 25;
  useEffect(() => {
    if (inCredits && onNext && countdown == null && !creditsDismissed) setCountdown(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCredits]);

  return (
    <div ref={wrap} className={cn("relative h-full w-full bg-background", idle && "cursor-none")} onDoubleClick={toggleFull}>
      <video
        ref={video}
        className="h-full w-full"
        playsInline
        crossOrigin="anonymous"
        aria-label={title}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); const v = video.current; if (v?.duration) onProgress?.(v.currentTime, v.duration); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVol(e.currentTarget.volume); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => { startedRef.current = true; setLoading(false); }}
        onCanPlay={() => setLoading(false)}
        onEnded={() => { const v = video.current; if (v) onProgress?.(v.duration, v.duration); onEnded?.(); if (onNext && countdown == null) setCountdown(6); }}
        onError={(e) => { if (source.kind !== "hls" && source.kind !== "dash") { const c = e.currentTarget.error?.code; fail(c === 4 ? `unsupported: media error ${c}` : `media error ${c ?? "?"}`); } }}
      >
        {source.subtitles.map((s, i) => <track key={s.url + i} kind="subtitles" srcLang={s.lang} label={s.label} src={s.url} />)}
      </video>

      {loading && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gold"><Star8 className="h-14 w-14 animate-star" /></div>}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
          <Star8 className="h-12 w-12 text-gold" />
          <p className="px-6 text-center font-display text-2xl" role="alert">{unsupported && unsupportedLabel ? unsupportedLabel : errorLabel}</p>
          <button onClick={() => setAttempt((a) => a + 1)} className="rounded-lg border border-gold/50 px-5 py-2 text-gold hover:bg-gold-soft">{retryLabel}</button>
        </div>
      )}

      {showSkipIntro && !error && (
        <button onClick={() => { const v = video.current; if (v && m.introEnd != null) v.currentTime = m.introEnd; }} className="absolute bottom-28 end-6 z-20 rounded-lg border border-foreground/30 bg-background/70 px-4 py-2 text-sm backdrop-blur hover:border-gold hover:text-gold">
          Skip intro
        </button>
      )}
      {showSkipRecap && !error && (
        <button onClick={() => { const v = video.current; if (v && m.recapEnd != null) v.currentTime = m.recapEnd; }} className="absolute bottom-28 end-6 z-20 rounded-lg border border-foreground/30 bg-background/70 px-4 py-2 text-sm backdrop-blur hover:border-gold hover:text-gold">
          Skip recap
        </button>
      )}
      {badge && <span className="pointer-events-none absolute start-4 top-20 z-10 rounded-md bg-destructive px-2 py-1 text-xs font-bold tracking-wider text-destructive-foreground">{badge}</span>}
      {countdown != null && onNext && (
        <div className="absolute bottom-28 end-6 z-20 w-80 rounded-xl border border-gold/40 bg-background/90 p-5 shadow-poster backdrop-blur" role="dialog" aria-label="Next episode">
          <p className="text-sm text-muted-foreground">{autoplayNext ? `Next episode starts in ${countdown} seconds` : "Up next"}</p>
          <p className="mt-1 font-display text-lg">{nextLabel}</p>
          <div className="mt-4 flex gap-3">
            <button onClick={() => { setCountdown(null); onNext(); }} className="rounded-lg bg-gold-gradient px-5 py-2.5 font-semibold text-primary-foreground">Play now</button>
            <button onClick={() => { setCountdown(null); setCreditsDismissed(true); }} className="rounded-lg border border-border px-5 py-2.5">Cancel</button>
          </div>
        </div>
      )}
      {nearEnd && onNext && countdown == null && (
        <button onClick={onNext} className="absolute bottom-28 end-6 z-20 inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 font-semibold text-primary-foreground shadow-glow">
          <SkipForward className="h-4 w-4" /> {nextLabel}
        </button>
      )}

      <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/60 to-transparent px-4 pb-4 pt-16 transition-opacity duration-500 sm:px-8", idle ? "opacity-0" : "opacity-100")}>
        <input
          type="range" min={0} max={dur || 0} step={0.1} value={time} aria-label="Seek"
          onChange={(e) => { const v = video.current; if (v) v.currentTime = Number(e.target.value); }}
          className="h-1 w-full cursor-pointer accent-[var(--gold)]"
          dir="ltr"
        />
        <div className="mt-3 flex items-center gap-1 sm:gap-3" dir="ltr">
          <Ctl label={playing ? "Pause" : "Play"} onClick={toggle}>{playing ? <Pause /> : <Play />}</Ctl>
          <Ctl label="Back 10 seconds" onClick={() => seek(-10)}><RotateCcw /></Ctl>
          <Ctl label="Forward 10 seconds" onClick={() => seek(10)}><RotateCw /></Ctl>
          <Ctl label={muted ? "Unmute" : "Mute"} onClick={() => { const v = video.current; if (v) v.muted = !v.muted; }}>{muted || vol === 0 ? <VolumeX /> : <Volume2 />}</Ctl>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol} aria-label="Volume" onChange={(e) => { const v = video.current; if (v) { v.volume = Number(e.target.value); v.muted = false; } }} className="hidden w-24 accent-[var(--gold)] sm:block" />
          <span className="ms-2 text-xs tabular-nums text-foreground/80">{fmt(time)} / {fmt(dur)}</span>
          <div className="ms-auto flex items-center gap-1 sm:gap-3">
            {onPrev && <Ctl label="Previous episode" onClick={onPrev}><SkipBack /></Ctl>}
            {onNext && <Ctl label={nextLabel ?? "Next"} onClick={onNext}><SkipForward /></Ctl>}
            <div className="relative">
              <Ctl label="Settings" onClick={() => setMenu((m) => !m)}><Settings /></Ctl>
              {menu && (
                <div className="absolute bottom-12 end-0 w-56 space-y-3 rounded-xl border border-border bg-popover p-4 text-sm shadow-poster">
                  <Sel label="Speed" value={String(rate)} onChange={(v) => { setRate(Number(v)); if (video.current) video.current.playbackRate = Number(v); }}
                    options={["0.5", "0.75", "1", "1.25", "1.5", "2"].map((r) => [r, `${r}×`])} />
                  {levels.length > 0 && (
                    <Sel label="Quality" value={String(level)} onChange={(v) => { setLevel(Number(v)); if (hlsRef.current) hlsRef.current.currentLevel = Number(v); }}
                      options={[["-1", "Auto"], ...levels.map((l, i) => [String(i), `${l.height}p`] as [string, string])]} />
                  )}
                  {tracks.length > 1 && (
                    <Sel label="Audio" value={String(track)} onChange={(v) => { const i = Number(v); if (hlsRef.current) hlsRef.current.audioTrack = i; setTrack(i); const l = tracks[i]?.lang; if (l) onAudioLanguage?.(l); if (an.current) trackEvent("audio_select", { titleId: an.current.titleId, episodeId: an.current.episodeId ?? null, ...(an.current.test ? { test: true } : {}), props: { lang: l ?? null } }); }}
                      options={tracks.map((a) => [String(a.id), a.name] as [string, string])} />
                  )}
                  {tracks.length <= 1 && audioOptions && audioOptions.length > 1 && onAudio && (
                    <Sel label="Audio" value={audio ?? ""} onChange={onAudio} options={audioOptions} />
                  )}
                  <Sel label="Subtitles" value={String(subIdx)} onChange={(v) => { const i = Number(v); setSubIdx(i); if (an.current) trackEvent("subtitle_select", { titleId: an.current.titleId, episodeId: an.current.episodeId ?? null, ...(an.current.test ? { test: true } : {}), props: { lang: source.subtitles[i]?.lang ?? "off" } }); }}
                    options={[["-1", "Off"], ...source.subtitles.map((s, i) => [String(i), s.label] as [string, string])]} />
                </div>
              )}
            </div>
            {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
              <Ctl label="Picture in picture" onClick={() => { const v = video.current; if (!v) return; document.pictureInPictureElement ? document.exitPictureInPicture() : v.requestPictureInPicture().catch(() => {}); }}><PictureInPicture2 /></Ctl>
            )}
            <Ctl label={full ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFull}>{full ? <Minimize /> : <Maximize />}</Ctl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ctl({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/10 hover:text-gold [&_svg]:h-5 [&_svg]:w-5">
      {children}
    </button>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-input bg-surface px-2 py-1">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, PictureInPicture2, RotateCcw, RotateCw, SkipForward, Volume2, VolumeX, Settings } from "lucide-react";
import { Star8 } from "@/components/mb/Brand";
import { cn } from "@/lib/utils";

export type PlayerSource = { kind: string; url: string; subtitles: { lang: string; label: string; url: string }[] };

type Props = {
  source: PlayerSource;
  title: string;
  startAt?: number;
  onProgress?: (pos: number, dur: number) => void;
  onEnded?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  errorLabel: string;
  retryLabel: string;
};

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(sec).padStart(2, "0")}`;
};

/** Provider-agnostic player: HLS via hls.js (or native), MP4 direct. DASH/embeds plug in by `kind`. */
export function Player({ source, title, startAt = 0, onProgress, onEnded, onNext, nextLabel, errorLabel, retryLabel }: Props) {
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
  const [subIdx, setSubIdx] = useState(-1);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [idle, setIdle] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let destroyed = false;
    setError(false);
    setLoading(true);
    const start = () => { if (startAt > 0 && startAt < (v.duration || Infinity) - 5) v.currentTime = startAt; v.play().catch(() => {}); };
    if (source.kind === "hls" && !v.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) return setError(true);
        const hls = new Hls({ capLevelToPlayerSize: true });
        hlsRef.current = hls;
        hls.loadSource(source.url);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => { setLevels(d.levels.map((l) => ({ height: l.height }))); start(); });
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else setError(true);
        });
      }).catch(() => setError(true));
    } else {
      v.src = source.url;
      v.addEventListener("loadedmetadata", start, { once: true });
    }
    return () => { destroyed = true; hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [source.url, source.kind, startAt, attempt]);

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
  }, [subIdx]);

  const showSkipIntro = time > 5 && time < 85;
  const nearEnd = dur > 0 && dur - time < 25;

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
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => { const v = video.current; if (v) onProgress?.(v.duration, v.duration); onEnded?.(); }}
        onError={() => setError(true)}
      >
        {source.subtitles.map((s) => <track key={s.lang} kind="subtitles" srcLang={s.lang} label={s.label} src={s.url} />)}
      </video>

      {loading && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gold"><Star8 className="h-14 w-14 animate-star" /></div>}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
          <Star8 className="h-12 w-12 text-gold" />
          <p className="font-display text-2xl">{errorLabel}</p>
          <button onClick={() => setAttempt((a) => a + 1)} className="rounded-lg border border-gold/50 px-5 py-2 text-gold hover:bg-gold-soft">{retryLabel}</button>
        </div>
      )}

      {showSkipIntro && !error && (
        <button onClick={() => { const v = video.current; if (v) v.currentTime = 90; }} className="absolute bottom-28 end-6 rounded-lg border border-foreground/30 bg-background/70 px-4 py-2 text-sm backdrop-blur hover:border-gold hover:text-gold">
          Skip intro
        </button>
      )}
      {nearEnd && onNext && (
        <button onClick={onNext} className="absolute bottom-28 end-6 inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 font-semibold text-primary-foreground shadow-glow">
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
                  <Sel label="Subtitles" value={String(subIdx)} onChange={(v) => setSubIdx(Number(v))}
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

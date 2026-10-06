import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mbButton } from "@/components/mb/Button";
import { Badge } from "@/components/mb/Cards";
import { createProviderUpload, refreshSource, uploadSubtitle } from "@/features/streaming/streaming.functions";
import { cn } from "@/lib/utils";

const field = "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
const RIGHTS = "I confirm MOROBEST is authorized to distribute this video.";
const DUP = "This title already has a playable video.";
const SUB_LANGS = [["ar", "العربية"], ["fr", "Français"], ["en", "English"]] as const;
const AUDIO = [["", "Original"], ["ar", "Arabic"], ["fr", "French"], ["en", "English"]] as const;

export type IngestEpisode = { id: string; season: number; number: number; title: string };
type Phase = "queued" | "uploading" | "processing" | "ready" | "failed";
type Job = {
  key: string; file: File; episodeId: string | null; season: number | null; episode: number | null;
  phase: Phase; pct: number; sourceId?: string; error?: string; subs?: Partial<Record<"ar" | "fr" | "en", File>>;
};
type OnExisting = "replace" | "alternate" | undefined;

/** Strict SxxEyy matcher — anything else is flagged, never guessed. */
export function parseEpisodeFilename(name: string): { season: number; episode: number } | null {
  const m = name.match(/^S(\d{1,2})E(\d{1,3})(?:[ ._-][^/]*)?\.(mp4|mov|mkv|m4v|webm|avi)$/i);
  if (!m) return null;
  const hits = name.match(/S\d{1,2}E\d{1,3}/gi) ?? [];
  if (hits.length !== 1) return null;
  return { season: Number(m[1]), episode: Number(m[2]) };
}

const PHASE_TONE: Record<Phase, "default" | "gold" | "red" | "green"> = { queued: "default", uploading: "gold", processing: "gold", ready: "green", failed: "red" };
const PHASE_LABEL: Record<Phase, string> = { queued: "Queued", uploading: "Uploading", processing: "Processing", ready: "Ready", failed: "Failed" };

function putFile(method: "PUT" | "POST", url: string, file: File, onPct: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — network error"));
    if (method === "POST") { const fd = new FormData(); fd.append("file", file); xhr.send(fd); } else xhr.send(file);
  });
}

export function MediaIngest({ titleId, titleName, isSeries, episodes, muxReady }: {
  titleId: string; titleName: string; isSeries: boolean; episodes: IngestEpisode[]; muxReady: boolean;
}) {
  const uploadFn = useServerFn(createProviderUpload);
  const refreshFn = useServerFn(refreshSource);
  const subFn = useServerFn(uploadSubtitle);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rights, setRights] = useState(false);
  const [audio, setAudio] = useState("");
  const [signed, setSigned] = useState(false);
  const [running, setRunning] = useState(false);
  const [dup, setDup] = useState<{ resolve: (v: OnExisting | "cancel") => void; label: string } | null>(null);

  // Single upload state
  const [unit, setUnit] = useState<string>(isSeries ? "" : "__movie");
  const [file, setFile] = useState<File | null>(null);
  const [subs, setSubs] = useState<Partial<Record<"ar" | "fr" | "en", File>>>({});

  // Bulk state
  const seasons = useMemo(() => [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b), [episodes]);
  const [season, setSeason] = useState<number | "">(seasons[0] ?? "");
  const [bulk, setBulk] = useState<{ file: File; parsed: ReturnType<typeof parseEpisodeFilename>; ep: IngestEpisode | null; problem: string | null }[]>([]);

  const patchJob = (key: string, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...p } : j)));

  // Live status from the database (webhook updates) + provider polling fallback.
  const ids = jobs.map((j) => j.sourceId).filter(Boolean) as string[];
  const pending = jobs.some((j) => j.phase === "processing");
  const rows = useQuery({
    queryKey: ["admin", "ingest", ids],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("video_sources").select("id, status, provider_asset_id, duration_s, error_message").in("id", ids)).data ?? [],
    refetchInterval: pending ? 5000 : false,
  });
  useEffect(() => {
    for (const r of rows.data ?? []) {
      const j = jobs.find((x) => x.sourceId === r.id);
      if (!j || j.phase === "uploading" || j.phase === "queued") continue;
      const phase: Phase = r.status === "ready" ? "ready" : r.status === "failed" ? "failed" : "processing";
      if (phase !== j.phase) patchJob(j.key, { phase, error: r.error_message ?? undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.data]);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      jobs.filter((j) => j.phase === "processing" && j.sourceId).forEach((j) => refreshFn({ data: { sourceId: j.sourceId! } }).catch(() => null));
    }, 15000);
    return () => clearInterval(t);
  }, [pending, jobs, refreshFn]);
  const rowFor = (id?: string) => rows.data?.find((r) => r.id === id);

  const askDuplicate = (label: string) => new Promise<OnExisting | "cancel">((resolve) => setDup({ resolve, label }));

  async function runJob(job: Job) {
    let onExisting: OnExisting;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        patchJob(job.key, { phase: "uploading", pct: 0, error: undefined });
        const t = await uploadFn({ data: {
          titleId, episodeId: job.episodeId, provider: "mux", signed, rightsConfirmed: true, filename: job.file.name.slice(0, 200), onExisting,
          audioLanguage: audio || null, language: audio || null, isActive: true, isTest: false,
        } });
        patchJob(job.key, { sourceId: t.sourceId });
        await putFile(t.method, t.uploadUrl, job.file, (pct) => patchJob(job.key, { pct }));
        await supabase.from("video_sources").update({ status: "processing" }).eq("id", t.sourceId).eq("status", "uploading");
        patchJob(job.key, { phase: "processing", pct: 100 });
        for (const [lang, label] of SUB_LANGS) {
          const f = job.subs?.[lang];
          if (!f) continue;
          try {
            await subFn({ data: { titleId, episodeId: job.episodeId, lang, label, filename: f.name, content: await f.text(), isDefault: false } });
          } catch (e) { toast.error(`${label} subtitle: ${(e as Error).message}`); }
        }
        return;
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.startsWith("DUPLICATE") && attempt === 0) {
          const choice = await askDuplicate(job.episodeId ? `S${job.season}E${job.episode}` : titleName);
          if (choice === "cancel") { patchJob(job.key, { phase: "failed", error: "Cancelled — existing video kept" }); return; }
          onExisting = choice;
          continue;
        }
        patchJob(job.key, { phase: "failed", error: msg.replace(/^DUPLICATE: /, "") });
        return;
      }
    }
  }

  async function start(newJobs: Job[]) {
    if (!rights) { toast.error(RIGHTS); return; }
    setJobs((js) => [...newJobs, ...js]);
    setRunning(true);
    for (const j of newJobs) await runJob(j); // sequential: predictable bandwidth and duplicate prompts
    setRunning(false);
  }

  const startSingle = () => {
    if (!file) return toast.error("Choose a video file");
    if (!unit) return toast.error("Choose the movie or episode this video belongs to");
    const ep = episodes.find((e) => e.id === unit);
    start([{ key: crypto.randomUUID(), file, episodeId: ep?.id ?? null, season: ep?.season ?? null, episode: ep?.number ?? null, phase: "queued", pct: 0, subs }]);
    setFile(null); setSubs({});
  };

  const pickBulk = (files: FileList | null) => {
    const list = [...(files ?? [])];
    const seen = new Map<string, number>();
    const parsed = list.map((f) => {
      const p = parseEpisodeFilename(f.name);
      if (p) seen.set(`${p.season}x${p.episode}`, (seen.get(`${p.season}x${p.episode}`) ?? 0) + 1);
      return { file: f, parsed: p };
    });
    setBulk(parsed.map(({ file: f, parsed: p }) => {
      if (!p) return { file: f, parsed: p, ep: null, problem: "Name must look like S01E01.mp4" };
      if (season !== "" && p.season !== season) return { file: f, parsed: p, ep: null, problem: `Not in season ${season}` };
      if ((seen.get(`${p.season}x${p.episode}`) ?? 0) > 1) return { file: f, parsed: p, ep: null, problem: "Two files for the same episode" };
      const ep = episodes.find((e) => e.season === p.season && e.number === p.episode) ?? null;
      return { file: f, parsed: p, ep, problem: ep ? null : "Episode not found in MOROBEST" };
    }).sort((a, b) => (a.parsed?.episode ?? 999) - (b.parsed?.episode ?? 999)));
  };
  const bulkOk = bulk.filter((b) => b.ep && !b.problem);

  const startBulk = () => {
    start(bulkOk.map((b) => ({ key: crypto.randomUUID(), file: b.file, episodeId: b.ep!.id, season: b.ep!.season, episode: b.ep!.number, phase: "queued" as Phase, pct: 0 })));
    setBulk([]);
  };

  if (!muxReady) return <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">Mux production credentials are not configured.</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
        <h3 className="font-display text-xl">Upload one video</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={field} value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Movie or episode">
            {!isSeries && <option value="__movie">Movie — {titleName}</option>}
            {isSeries && <option value="">Choose an episode…</option>}
            {episodes.map((e) => <option key={e.id} value={e.id}>S{String(e.season).padStart(2, "0")}E{String(e.number).padStart(2, "0")} — {e.title}</option>)}
          </select>
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" aria-label="Video file" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SUB_LANGS.map(([l, label]) => (
            <label key={l} className="text-xs text-muted-foreground">{label} subtitles (.srt/.vtt, optional)
              <input type="file" accept=".srt,.vtt" className="mt-1 block w-full text-sm" onChange={(e) => setSubs((s) => ({ ...s, [l]: e.target.files?.[0] }))} />
            </label>
          ))}
        </div>
        <button className={mbButton()} disabled={running || !file || !unit} onClick={startSingle}>Upload video</button>
      </section>

      {isSeries && (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <h3 className="font-display text-xl">Bulk episode upload</h3>
          <p className="text-xs text-muted-foreground">Name files like <code>S01E01.mp4</code>, <code>S01E02.mp4</code>. Files that don't match exactly are listed but never uploaded.</p>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <select className={field} value={season} onChange={(e) => { setSeason(e.target.value ? Number(e.target.value) : ""); setBulk([]); }} aria-label="Season">
              {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
            </select>
            <input type="file" multiple accept="video/*" onChange={(e) => pickBulk(e.target.files)} className="block w-full text-sm" aria-label="Episode files" />
          </div>
          {seasons.length === 0 && <p className="text-sm text-destructive">This series has no episodes in MOROBEST yet — sync episodes on the title page first.</p>}
          {bulk.length > 0 && (
            <>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-start text-xs text-muted-foreground"><tr><th className="p-2 text-start">File</th><th className="p-2 text-start">Season</th><th className="p-2 text-start">Episode</th><th className="p-2 text-start">Matched to</th></tr></thead>
                <tbody>{bulk.map((b) => (
                  <tr key={b.file.name} className="border-t border-border">
                    <td className="p-2">{b.file.name}</td><td className="p-2">{b.parsed?.season ?? "—"}</td><td className="p-2">{b.parsed?.episode ?? "—"}</td>
                    <td className={cn("p-2", b.problem && "text-destructive")}>{b.problem ?? b.ep?.title}</td>
                  </tr>
                ))}</tbody>
              </table></div>
              <button className={mbButton()} disabled={running || bulkOk.length === 0} onClick={startBulk}>Confirm & upload {bulkOk.length} episode{bulkOk.length === 1 ? "" : "s"}</button>
            </>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-gold/40 bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Audio track language
            <select className={field} value={audio} onChange={(e) => setAudio(e.target.value)}>{AUDIO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} className="accent-[var(--gold)]" />Signed (private) playback</label>
        </div>
        <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 accent-[var(--gold)]" />{RIGHTS}</label>
        <p className="text-xs text-muted-foreground">Upload only files you own or are licensed to distribute. Videos go live automatically once Mux finishes processing.</p>
      </section>

      {jobs.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-border bg-surface p-3">
          <table className="w-full text-sm" data-testid="ingest-table">
            <thead className="text-xs text-muted-foreground"><tr>{["File", "Title", "Season", "Episode", "Duration", "Mux asset ID", "Status"].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
            <tbody>{jobs.map((j) => {
              const r = rowFor(j.sourceId);
              return (
                <tr key={j.key} className="border-t border-border align-top">
                  <td className="p-2">{j.file.name}</td><td className="p-2">{titleName}</td>
                  <td className="p-2">{j.season ?? "—"}</td><td className="p-2">{j.episode ?? "—"}</td>
                  <td className="p-2">{r?.duration_s ? `${Math.round(Number(r.duration_s) / 60)} min` : "—"}</td>
                  <td className="p-2 font-mono text-xs">{r?.provider_asset_id ?? "—"}</td>
                  <td className="p-2"><Badge tone={PHASE_TONE[j.phase]}>{PHASE_LABEL[j.phase]}{j.phase === "uploading" ? ` ${j.pct}%` : ""}</Badge>{j.error && <p className="mt-1 text-xs text-destructive">{j.error}</p>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </section>
      )}

      {dup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6">
            <p className="font-display text-xl">{DUP}</p>
            <p className="text-sm text-muted-foreground">{dup.label}: replace the current video once the new one is ready, add this as an alternate source, or cancel.</p>
            <div className="flex flex-wrap gap-2">
              <button className={mbButton()} onClick={() => { dup.resolve("replace"); setDup(null); }}>Replace</button>
              <button className={mbButton({ variant: "outline" })} onClick={() => { dup.resolve("alternate"); setDup(null); }}>Add Alternate Source</button>
              <button className={mbButton({ variant: "ghost" })} onClick={() => { dup.resolve("cancel"); setDup(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

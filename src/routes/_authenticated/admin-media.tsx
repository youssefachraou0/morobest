import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader, EmptyState } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { mbButton } from "@/components/mb/Button";
import { Badge } from "@/components/mb/Cards";
import { Player } from "@/features/player/Player";
import {
  addUrlSource, attachMuxPlaybackId, attachProviderAsset, createProviderUpload, previewSource, providerConfig, refreshSource,
  saveMarkers, uploadSubtitle,
} from "@/features/streaming/streaming.functions";
import { cn } from "@/lib/utils";
import { MediaIngest } from "@/components/mb/MediaIngest";

type Tab = "import" | "sources" | "subtitles" | "markers";
export const Route = createFileRoute("/_authenticated/admin-media")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; title?: string } => ({ tab: s.tab === "subtitles" || s.tab === "markers" ? s.tab : undefined, title: typeof s.title === "string" ? s.title : undefined }),
  head: () => ({ meta: [{ title: "Media · MOROBEST Admin" }, { name: "description", content: "Manage MOROBEST video sources, subtitles and markers." }, { name: "robots", content: "noindex" }] }),
  component: MediaAdmin,
});

type Mode = "upload" | "asset" | "playback" | "url";
const field = "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
const STATUS_TONE: Record<string, "default" | "gold" | "red" | "green"> = { ready: "green", failed: "red", uploading: "gold", processing: "gold", disabled: "default" };
const MUX_TEST_PLAYBACK = "v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM";

const toTimecode = (s: number | null | undefined) =>
  s == null ? "" : [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
const fromTimecode = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) throw new Error(`Invalid time "${v}"`);
  return parts.reduce((a, n) => a * 60 + n, 0);
};

function MediaAdmin() {
  const { canManageMedia, ready, rolesReady } = useAuth();
  const { tab = "sources", title: initialTitle } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [titleId, setTitleId] = useState(initialTitle ?? "");
  const [episodeId, setEpisodeId] = useState("");

  const titles = useQuery({
    queryKey: ["admin", "media-titles"], enabled: canManageMedia,
    queryFn: async () => (await supabase.from("titles")
      .select("id, slug, original_title, kind, year, poster_url, intro_start_s, intro_end_s, credits_start_s, external_titles(provider, provider_id, media_type), seasons(number, episodes(id, number, title, intro_start_s, intro_end_s, recap_start_s, recap_end_s, credits_start_s))")
      .neq("kind", "manga").order("original_title")).data ?? [],
  });
  const list = (titles.data ?? []).filter((t) => !q || t.original_title.toLowerCase().includes(q.toLowerCase()) || t.kind.includes(q.toLowerCase()));
  const sel = titles.data?.find((t) => t.id === titleId);
  const episodes = useMemo(
    () => (sel?.seasons ?? []).slice().sort((a, b) => a.number - b.number).flatMap((s) => (s.episodes ?? []).slice().sort((a, b) => a.number - b.number).map((e) => ({ ...e, label: `S${s.number}E${e.number} — ${e.title}` }))),
    [sel],
  );
  const ingestEpisodes = useMemo(
    () => (sel?.seasons ?? []).flatMap((s) => (s.episodes ?? []).map((e) => ({ id: e.id, season: s.number, number: e.number, title: e.title })))
      .sort((a, b) => a.season - b.season || a.number - b.number),
    [sel],
  );
  const cfgFn = useServerFn(providerConfig);
  const cfg = useQuery({ queryKey: ["admin", "providers"], queryFn: () => cfgFn(), enabled: canManageMedia });

  if (!ready || !rolesReady) return <StarLoader className="min-h-screen" />;
  if (!canManageMedia) return <div className="pt-32"><EmptyState title="Media managers only" body="Your account does not have access to media management." /></div>;

  return (
    <div className="pb-16">
      <PageHeader eyebrow="Admin · Media" title="Streaming" subtitle="Attach authorized video, subtitles and intro/credits markers to movies and episodes. Public Watch buttons appear only for real, ready, active sources.">
        <div className="mt-4 flex gap-4 text-sm">
          <Link to="/admin" className="text-muted-foreground hover:text-gold">← Dashboard</Link>
          <Link to="/admin-settings" className="text-muted-foreground hover:text-gold">Streaming providers</Link>
        </div>
      </PageHeader>
      <div className="grid gap-8 px-4 sm:px-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:px-14">
        <aside className="space-y-3">
          <input className={field} placeholder="Search movie, series, anime…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search content" />
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-2">
            {list.map((t) => (
              <li key={t.id}>
                <button onClick={() => { setTitleId(t.id); setEpisodeId(""); }} className={cn("flex w-full items-center gap-3 rounded-lg p-2 text-start text-sm hover:bg-surface-2", t.id === titleId && "bg-surface-2 ring-1 ring-gold/50")}>
                  {t.poster_url ? <img src={t.poster_url} alt="" className="h-12 w-8 rounded object-cover" /> : <span className="h-12 w-8 rounded bg-surface-2" />}
                  <span className="min-w-0"><span className="line-clamp-1 font-medium">{t.original_title}</span><span className="text-xs text-muted-foreground">{t.kind} · {t.year}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="min-w-0 space-y-5">
          {!sel ? <EmptyState title="Pick a title" body="Search and select a movie, series or anime." /> : (
            <>
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4">
                {sel.poster_url && <img src={sel.poster_url} alt="" className="h-24 w-16 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl">{sel.original_title}</p>
                  <p className="text-xs text-muted-foreground">{sel.kind} · {sel.year} · MOROBEST /{sel.slug}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(sel.external_titles ?? []).length ? sel.external_titles.map((x) => <Badge key={x.provider + x.provider_id}>{x.provider.toUpperCase()} {x.media_type} #{x.provider_id}</Badge>) : <Badge>No TMDB/AniList link</Badge>}
                  </div>
                </div>
                {episodes.length > 0 && tab !== "import" && (
                  <select className={cn(field, "w-auto")} value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} aria-label="Episode">
                    <option value="">{tab === "sources" ? "Whole series (fallback)" : "Choose an episode…"}</option>
                    {episodes.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                )}
              </div>
              <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
                {(["sources", "subtitles", "markers"] as const).map((t) => (
                  <button key={t} onClick={() => navigate({ search: { tab: t === "sources" ? undefined : t }, replace: true })} className={cn("flex-1 rounded-md px-2 py-1.5 capitalize", tab === t ? "bg-background text-gold" : "text-muted-foreground")}>{t === "markers" ? "Intro / recap / credits" : t}</button>
                ))}
              </div>
              {null}
              {tab === "sources" && <Sources titleId={sel.id} episodeId={episodeId} episodes={episodes} />}
              {tab === "subtitles" && <Subtitles titleId={sel.id} episodeId={episodeId} needsEpisode={episodes.length > 0} />}
              {tab === "markers" && (
                <Markers key={sel.id + episodeId} titleId={sel.id} episodeId={episodeId || null} needsEpisode={episodes.length > 0}
                  initial={episodeId ? episodes.find((e) => e.id === episodeId) ?? null : { intro_start_s: sel.intro_start_s, intro_end_s: sel.intro_end_s, credits_start_s: sel.credits_start_s, recap_start_s: null, recap_end_s: null }}
                  onSaved={() => titles.refetch()} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Sources({ titleId, episodeId, episodes }: { titleId: string; episodeId: string; episodes: { id: string; label: string }[] }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("url");
  const [provider, setProvider] = useState<"mux" | "cloudflare">("cloudflare");
  const [kind, setKind] = useState<"hls" | "dash" | "mp4" | "embed">("hls");
  const [url, setUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [playbackId, setPlaybackId] = useState("");
  const [signed, setSigned] = useState(false);
  const [language, setLanguage] = useState("");
  const [audioLanguage, setAudioLanguage] = useState("");
  const [quality, setQuality] = useState("");
  const [isDubbed, setDubbed] = useState(false);
  const [isSubbed, setSubbed] = useState(false);
  const [isDefault, setDefault] = useState(false);
  const [isActive, setActive] = useState(true);
  const [isTest, setTest] = useState(false);
  const [countries, setCountries] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSource>> | null>(null);

  const cfgFn = useServerFn(providerConfig);
  const uploadFn = useServerFn(createProviderUpload);
  const assetFn = useServerFn(attachProviderAsset);
  const playbackFn = useServerFn(attachMuxPlaybackId);
  const urlFn = useServerFn(addUrlSource);
  const refreshFn = useServerFn(refreshSource);
  const previewFn = useServerFn(previewSource);
  const cfg = useQuery({ queryKey: ["admin", "providers"], queryFn: () => cfgFn() });
  const providerReady = provider === "mux" ? !!cfg.data?.mux : !!cfg.data?.cloudflare;

  const sources = useQuery({
    queryKey: ["admin", "sources", titleId],
    queryFn: async () => (await supabase.from("video_sources")
      .select("id, episode_id, provider, kind, status, is_active, is_default, is_test_source, language, audio_language, quality, is_dubbed, is_subbed, requires_signed_token, playback_id, provider_asset_id, availability_country, available_from, available_until, error_message, updated_at, playback_errors(message, provider, device, created_at)")
      .eq("title_id", titleId).order("created_at")).data ?? [],
    refetchInterval: (qq) => ((qq.state.data ?? []).some((s) => s.status === "uploading" || s.status === "processing") ? 8000 : false),
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["admin", "sources", titleId] });

  useEffect(() => {
    const pending = (sources.data ?? []).filter((s) => s.status === "uploading" || s.status === "processing");
    if (!pending.length) return;
    const id = setInterval(() => { Promise.all(pending.map((s) => refreshFn({ data: { sourceId: s.id } }).catch(() => null))).then(reload); }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.data]);

  const metaData = () => ({
    titleId, episodeId: episodeId || null, language: language || null, audioLanguage: audioLanguage || null, quality: quality || null,
    isDubbed, isSubbed, isDefault, isActive, isTest,
    countries: countries.trim() ? countries.toUpperCase().split(/[\s,]+/).filter(Boolean) : null,
    availableFrom: from ? new Date(from).toISOString() : null, availableUntil: until ? new Date(until).toISOString() : null,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "url") return urlFn({ data: { ...metaData(), kind, url } });
      if (mode === "playback") return playbackFn({ data: { ...metaData(), playbackId } });
      if (mode === "asset") return assetFn({ data: { ...metaData(), provider, assetId, signed } });
      if (!file) throw new Error("Choose a video file");
      const t = await uploadFn({ data: { ...metaData(), provider, signed } });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(t.method, t.uploadUrl);
        xhr.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        if (t.method === "POST") { const fd = new FormData(); fd.append("file", file); xhr.send(fd); } else xhr.send(file);
      });
      await supabase.from("video_sources").update({ status: "processing" }).eq("id", t.sourceId);
      return t;
    },
    onSuccess: () => { toast.success("Source saved"); setPct(null); setUrl(""); setAssetId(""); setPlaybackId(""); setFile(null); reload(); },
    onError: (e: Error) => { toast.error(e.message); setPct(null); reload(); },
  });

  const update = async (id: string, patch: { is_active?: boolean; is_default?: boolean; status?: string; is_test_source?: boolean }) => {
    const { error } = await supabase.from("video_sources").update(patch).eq("id", id);
    if (error) toast.error(error.message); else reload();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this source?")) return;
    const { error } = await supabase.from("video_sources").delete().eq("id", id);
    if (error) toast.error(error.message); else reload();
  };
  const needsProvider = mode === "upload" || mode === "asset";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_1fr]">
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          
          <Badge tone={cfg.data?.cloudflare ? "green" : "default"}>Cloudflare {cfg.data?.cloudflare ? "connected" : "optional"}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-xs">
          {([["url", "HLS / DASH / MP4 / embed"], ["asset", "Cloudflare asset"]] as const).map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-2 py-1.5 ${mode === m ? "bg-background text-gold" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        {needsProvider && (
          <>
            <select className={field} value={provider} onChange={(e) => setProvider(e.target.value as "mux" | "cloudflare")} aria-label="Provider">
              <option value="cloudflare">Cloudflare Stream (optional)</option>
            </select>
            {!providerReady && <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">{provider === "mux" ? "Mux production credentials not configured." : "Cloudflare Stream not configured."} <Link to="/admin-settings" className="text-gold">Settings</Link></p>}
            {mode === "upload"
              ? <input type="file" accept="video/*" disabled={!providerReady} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              : <input className={field} disabled={!providerReady} placeholder={provider === "mux" ? "Mux asset ID" : "Cloudflare video ID"} value={assetId} onChange={(e) => setAssetId(e.target.value.trim())} />}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} className="accent-[var(--gold)]" />Signed (private) playback</label>
          </>
        )}
        {mode === "playback" && (
          <>
            <input className={field} placeholder="Mux public playback ID" value={playbackId} onChange={(e) => setPlaybackId(e.target.value.trim())} />
            <button type="button" className="text-xs text-gold" onClick={() => { setPlaybackId(MUX_TEST_PLAYBACK); setTest(true); }}>Use Mux's official public test asset (marks as TEST VIDEO)</button>
          </>
        )}
        {mode === "url" && (
          <>
            <select className={field} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Source type">
              <option value="hls">Authorized HLS (.m3u8)</option><option value="dash">Authorized DASH (.mpd)</option><option value="mp4">Authorized MP4</option><option value="embed">Official allowed embed</option>
            </select>
            <input className={field} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="Language (ar, fr, en…)" value={language} onChange={(e) => setLanguage(e.target.value)} />
          <input className={field} placeholder="Audio language" value={audioLanguage} onChange={(e) => setAudioLanguage(e.target.value)} />
          <select className={field} value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Quality">
            <option value="">Adaptive quality</option>{["360p", "480p", "720p", "1080p", "4K"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <input className={field} placeholder="Countries: MA, FR" value={countries} onChange={(e) => setCountries(e.target.value)} />
          <label className="text-xs text-muted-foreground">Available from<input type="datetime-local" className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">Available until<input type="datetime-local" className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {([["Dubbed", isDubbed, setDubbed], ["Subbed", isSubbed, setSubbed], ["Default", isDefault, setDefault], ["Active", isActive, setActive], ["Test video", isTest, setTest]] as const).map(([l, v, f]) => (
            <label key={l} className="flex items-center gap-2"><input type="checkbox" checked={v} onChange={(e) => f(e.target.checked)} className="accent-[var(--gold)]" />{l}</label>
          ))}
        </div>
        <button disabled={submit.isPending || (needsProvider && !providerReady)} onClick={() => submit.mutate()} className={mbButton({ className: "w-full" })}>
          {submit.isPending ? (pct != null ? `Uploading ${pct}%` : "Saving…") : mode === "upload" ? "Upload video" : "Add source"}
        </button>
      </section>

      <section className="min-w-0">
        {sources.isLoading ? <StarLoader /> : (sources.data ?? []).length === 0 ? (
          <EmptyState title="No sources yet" body="Viewers see “Not currently available to watch” until a real source is ready." />
        ) : (
          <div className="space-y-3">
            {(sources.data ?? []).map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-surface p-4" data-testid="source-row">
                <div className="flex flex-wrap items-center gap-2">
                  {s.is_test_source && <Badge tone="red">TEST VIDEO</Badge>}
                  <Badge tone={s.is_active ? STATUS_TONE[s.status] : "default"}>{s.is_active ? s.status : "disabled"}</Badge>
                  <span className="font-medium">{s.provider} · {s.kind}</span>
                  <span className="text-xs text-muted-foreground">{s.episode_id ? episodes.find((e) => e.id === s.episode_id)?.label ?? "Episode" : "Whole title"}</span>
                  {s.language && <Badge>{s.language}{s.is_dubbed ? " dub" : ""}{s.is_subbed ? " sub" : ""}</Badge>}
                  {s.audio_language && s.audio_language !== s.language && <Badge>audio {s.audio_language}</Badge>}
                  {s.quality && <Badge>{s.quality}</Badge>}
                  {s.requires_signed_token && <Badge tone="gold">signed</Badge>}
                  {s.is_default && <Badge tone="gold">default</Badge>}
                  {s.availability_country?.length ? <Badge>{s.availability_country.join(" ")}</Badge> : null}
                </div>
                {(s.available_from || s.available_until) && <p className="mt-1 text-xs text-muted-foreground">Window: {s.available_from?.slice(0, 16) ?? "…"} → {s.available_until?.slice(0, 16) ?? "…"}</p>}
                {s.error_message && <p className="mt-2 text-sm text-destructive">{s.error_message}</p>}
                {(s.playback_errors ?? []).length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.playback_errors.length} viewer error(s) · latest: {s.playback_errors[s.playback_errors.length - 1]?.message}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.status === "ready" && <button className={mbButton({ variant: "outline", size: "sm" })} onClick={async () => { try { setPreview(await previewFn({ data: { sourceId: s.id } })); } catch (e) { toast.error((e as Error).message); } }}>Preview</button>}
                  {(s.status === "uploading" || s.status === "processing") && <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => refreshFn({ data: { sourceId: s.id } }).then(reload)}>Check status</button>}
                  {s.status !== "ready" && s.status !== "uploading" && <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => update(s.id, { status: "ready" })}>Mark ready</button>}
                  <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => update(s.id, { is_active: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button>
                  {!s.is_default && <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => update(s.id, { is_default: true })}>Make default</button>}
                  <button className={mbButton({ variant: "ghost", size: "sm" })} onClick={() => remove(s.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setPreview(null)}>
          <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
            {preview.kind === "embed"
              ? <iframe src={preview.url} title="Preview" className="h-full w-full" allowFullScreen />
              : <Player source={preview} title="Preview" errorLabel="Playback failed" retryLabel="Retry" />}
          </div>
        </div>
      )}
    </div>
  );
}

const LANGS: [string, string][] = [["ar", "العربية"], ["fr", "Français"], ["en", "English"], ["es", "Español"], ["de", "Deutsch"], ["tr", "Türkçe"], ["ber", "Tamaziɣt"]];

function Subtitles({ titleId, episodeId, needsEpisode }: { titleId: string; episodeId: string; needsEpisode: boolean }) {
  const [lang, setLang] = useState("ar");
  const [label, setLabel] = useState("العربية");
  const [forced, setForced] = useState(false);
  const [sdh, setSdh] = useState(false);
  const [isDefault, setDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const upFn = useServerFn(uploadSubtitle);
  const tracks = useQuery({
    queryKey: ["admin", "subs", titleId, episodeId],
    queryFn: async () => {
      let qq = supabase.from("subtitle_tracks").select("id, lang, label, url, is_forced, is_sdh, is_default, is_active, created_at").eq("title_id", titleId);
      qq = episodeId ? qq.eq("episode_id", episodeId) : qq.is("episode_id", null);
      return (await qq.order("created_at")).data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a .vtt or .srt file");
      if (file.size > 2_000_000) throw new Error("Subtitle file is too large (max 2 MB)");
      const content = await file.text();
      return upFn({ data: { titleId, episodeId: episodeId || null, lang, label, forced, sdh, isDefault, filename: file.name, content, replaceId: replaceId ?? undefined } });
    },
    onSuccess: () => { toast.success(replaceId ? "Subtitle replaced" : "Subtitle uploaded"); setFile(null); setReplaceId(null); tracks.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = async (id: string, p: { is_active?: boolean; is_default?: boolean }) => {
    const { error } = await supabase.from("subtitle_tracks").update(p).eq("id", id);
    if (error) toast.error(error.message); else tracks.refetch();
  };
  if (needsEpisode && !episodeId) return <EmptyState title="Choose an episode" body="Subtitles are attached to a specific episode." />;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_1fr]">
      <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
        {replaceId && <p className="text-xs text-gold">Replacing an existing track · <button className="underline" onClick={() => setReplaceId(null)}>cancel</button></p>}
        <div className="grid grid-cols-2 gap-3">
          <select className={field} value={LANGS.some(([c]) => c === lang) ? lang : "other"} onChange={(e) => { const v = e.target.value; if (v !== "other") { setLang(v); setLabel(LANGS.find(([c]) => c === v)![1]); } }} aria-label="Language">
            {LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}<option value="other">Other…</option>
          </select>
          <input className={field} value={lang} onChange={(e) => setLang(e.target.value.trim())} placeholder="code" aria-label="Language code" />
        </div>
        <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" aria-label="Label" />
        <input type="file" accept=".vtt,.srt,text/vtt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" aria-label="Subtitle file" />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} className="accent-[var(--gold)]" />Forced</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={sdh} onChange={(e) => setSdh(e.target.checked)} className="accent-[var(--gold)]" />SDH</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isDefault} onChange={(e) => setDefault(e.target.checked)} className="accent-[var(--gold)]" />Default</label>
        </div>
        <p className="text-xs text-muted-foreground">SRT files are converted to WebVTT automatically.</p>
        <button disabled={save.isPending} onClick={() => save.mutate()} className={mbButton({ className: "w-full" })}>{save.isPending ? "Saving…" : replaceId ? "Replace subtitle" : "Upload subtitle"}</button>
      </section>
      <section className="space-y-3">
        {(tracks.data ?? []).length === 0 ? <EmptyState title="No subtitles yet" /> : (tracks.data ?? []).map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={s.is_active ? "green" : "default"}>{s.is_active ? "active" : "disabled"}</Badge>
              <span className="font-medium">{s.label}</span><Badge>{s.lang}</Badge>
              {s.is_forced && <Badge>forced</Badge>}{s.is_sdh && <Badge>SDH</Badge>}{s.is_default && <Badge tone="gold">default</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={mbButton({ variant: "outline", size: "sm" })} onClick={async () => setPreview(await (await fetch(s.url)).text().catch(() => "Unavailable"))}>Preview</button>
              <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => { setReplaceId(s.id); setLang(s.lang); setLabel(s.label); setForced(s.is_forced); setSdh(s.is_sdh); setDefault(s.is_default); }}>Replace</button>
              <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => patch(s.id, { is_active: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button>
              {!s.is_default && <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => patch(s.id, { is_default: true })}>Make default</button>}
              <button className={mbButton({ variant: "ghost", size: "sm" })} onClick={async () => { if (!confirm("Delete subtitle?")) return; await supabase.from("subtitle_tracks").delete().eq("id", s.id); tracks.refetch(); }}>Delete</button>
            </div>
          </div>
        ))}
        {preview && <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-surface p-4 text-xs" dir="auto">{preview.slice(0, 4000)}</pre>}
      </section>
    </div>
  );
}

type MarkerRow = { intro_start_s: number | null; intro_end_s: number | null; recap_start_s: number | null; recap_end_s: number | null; credits_start_s: number | null };
function Markers({ titleId, episodeId, needsEpisode, initial, onSaved }: { titleId: string; episodeId: string | null; needsEpisode: boolean; initial: MarkerRow | null; onSaved: () => void }) {
  const [v, setV] = useState({
    introStart: toTimecode(initial?.intro_start_s), introEnd: toTimecode(initial?.intro_end_s),
    recapStart: toTimecode(initial?.recap_start_s), recapEnd: toTimecode(initial?.recap_end_s), creditsStart: toTimecode(initial?.credits_start_s),
  });
  const fn = useServerFn(saveMarkers);
  const save = useMutation({
    mutationFn: () => fn({ data: {
      titleId, episodeId, introStart: fromTimecode(v.introStart), introEnd: fromTimecode(v.introEnd),
      recapStart: fromTimecode(v.recapStart), recapEnd: fromTimecode(v.recapEnd), creditsStart: fromTimecode(v.creditsStart),
    } }),
    onSuccess: () => { toast.success("Markers saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message.includes("[") ? "Check the times: end must be after start" : e.message),
  });
  if (needsEpisode && !episodeId) return <EmptyState title="Choose an episode" body="Intro, recap and credits times are set per episode." />;
  const inp = (k: keyof typeof v, label: string) => (
    <label className="text-sm">{label}<input className={field} placeholder="00:00:00" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <section className="max-w-xl space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="grid grid-cols-2 gap-3">
        {inp("introStart", "Intro start")}{inp("introEnd", "Intro end")}
        {episodeId && <>{inp("recapStart", "Recap start")}{inp("recapEnd", "Recap end")}</>}
        {inp("creditsStart", "Credits start")}
      </div>
      <p className="text-xs text-muted-foreground">Use hh:mm:ss. Leave blank when unknown — skip buttons only appear when times exist.</p>
      <button disabled={save.isPending} onClick={() => save.mutate()} className={mbButton()}>{save.isPending ? "Saving…" : "Save markers"}</button>
    </section>
  );
}

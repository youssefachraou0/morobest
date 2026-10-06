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
  addUrlSource, attachProviderAsset, createProviderUpload, previewSource, providerConfig, refreshSource,
} from "@/features/streaming/streaming.functions";

export const Route = createFileRoute("/_authenticated/admin-media")({
  head: () => ({ meta: [{ title: "Streaming sources · MOROBEST Admin" }, { name: "description", content: "Manage MOROBEST video sources." }, { name: "robots", content: "noindex" }] }),
  component: MediaAdmin,
});

type Mode = "upload" | "asset" | "url";
const field = "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
const STATUS_TONE: Record<string, "default" | "gold" | "red" | "green"> = { ready: "green", failed: "red", uploading: "gold", processing: "gold", disabled: "default" };

function MediaAdmin() {
  const { isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const [titleId, setTitleId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [mode, setMode] = useState<Mode>("upload");
  const [provider, setProvider] = useState<"mux" | "cloudflare">("mux");
  const [kind, setKind] = useState<"hls" | "dash" | "mp4" | "embed">("hls");
  const [url, setUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [signed, setSigned] = useState(false);
  const [language, setLanguage] = useState("");
  const [quality, setQuality] = useState("");
  const [isDubbed, setDubbed] = useState(false);
  const [isDefault, setDefault] = useState(false);
  const [countries, setCountries] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSource>> | null>(null);

  const cfgFn = useServerFn(providerConfig);
  const uploadFn = useServerFn(createProviderUpload);
  const assetFn = useServerFn(attachProviderAsset);
  const urlFn = useServerFn(addUrlSource);
  const refreshFn = useServerFn(refreshSource);
  const previewFn = useServerFn(previewSource);

  const cfg = useQuery({ queryKey: ["admin", "providers"], enabled: isAdmin, queryFn: () => cfgFn() });
  const titles = useQuery({
    queryKey: ["admin", "media-titles"], enabled: isAdmin,
    queryFn: async () => (await supabase.from("titles").select("id, original_title, kind, seasons(number, episodes(id, number, title))").neq("kind", "manga").order("original_title")).data ?? [],
  });
  const sel = titles.data?.find((t) => t.id === titleId);
  const episodes = useMemo(
    () => (sel?.seasons ?? []).sort((a, b) => a.number - b.number).flatMap((s) => (s.episodes ?? []).sort((a, b) => a.number - b.number).map((e) => ({ ...e, label: `S${s.number}E${e.number} — ${e.title}` }))),
    [sel],
  );
  const sources = useQuery({
    queryKey: ["admin", "sources", titleId], enabled: isAdmin && !!titleId,
    queryFn: async () => (await supabase.from("video_sources")
      .select("id, episode_id, provider, kind, status, is_active, is_default, language, quality, is_dubbed, requires_signed_token, playback_id, provider_asset_id, error_message, updated_at, playback_errors(message, created_at)")
      .eq("title_id", titleId).order("created_at")).data ?? [],
    refetchInterval: (q) => ((q.state.data ?? []).some((s) => s.status === "uploading" || s.status === "processing") ? 8000 : false),
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["admin", "sources", titleId] });

  // Poll provider for in-flight sources.
  useEffect(() => {
    const pending = (sources.data ?? []).filter((s) => s.status === "uploading" || s.status === "processing");
    if (!pending.length) return;
    const id = setInterval(() => { Promise.all(pending.map((s) => refreshFn({ data: { sourceId: s.id } }).catch(() => null))).then(reload); }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.data]);

  const metaData = () => ({
    titleId, episodeId: episodeId || null, language: language || null, quality: quality || null, isDubbed, isDefault,
    countries: countries.trim() ? countries.toUpperCase().split(/[\s,]+/).filter(Boolean) : null,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!titleId) throw new Error("Pick a title first");
      if (mode === "url") return urlFn({ data: { ...metaData(), kind, url } });
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
    onSuccess: () => { toast.success("Source saved"); setPct(null); setUrl(""); setAssetId(""); setFile(null); reload(); },
    onError: (e: Error) => { toast.error(e.message); setPct(null); reload(); },
  });

  const update = async (id: string, patch: { is_active?: boolean; is_default?: boolean; status?: string }) => {
    const { error } = await supabase.from("video_sources").update(patch).eq("id", id);
    if (error) toast.error(error.message); else reload();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this source?")) return;
    const { error } = await supabase.from("video_sources").delete().eq("id", id);
    if (error) toast.error(error.message); else reload();
  };

  if (!ready) return <StarLoader className="min-h-screen" />;
  if (!isAdmin) return <div className="pt-32"><EmptyState title="Admins only" body="Your account does not have access to the admin area." /></div>;

  return (
    <div className="pb-16">
      <PageHeader eyebrow="Admin · Media" title="Streaming sources" subtitle="Attach authorized video to movies and episodes. The Watch button appears only when a ready, active source exists.">
        <Link to="/admin" className="mt-4 inline-block text-sm text-muted-foreground hover:text-gold">← Back to dashboard</Link>
      </PageHeader>
      <div className="grid gap-8 px-4 sm:px-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:px-14">
        <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone={cfg.data?.mux ? "green" : "default"}>Mux {cfg.data?.mux ? "connected" : "not set up"}</Badge>
            <Badge tone={cfg.data?.muxSigned ? "green" : "default"}>Mux signing {cfg.data?.muxSigned ? "on" : "off"}</Badge>
            <Badge tone={cfg.data?.cloudflare ? "green" : "default"}>Cloudflare {cfg.data?.cloudflare ? "connected" : "not set up"}</Badge>
          </div>
          <label className="block text-sm">Title
            <select className={field} value={titleId} onChange={(e) => { setTitleId(e.target.value); setEpisodeId(""); }}>
              <option value="">Select a movie or series…</option>
              {(titles.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.original_title} · {t.kind}</option>)}
            </select>
          </label>
          {episodes.length > 0 && (
            <label className="block text-sm">Episode
              <select className={field} value={episodeId} onChange={(e) => setEpisodeId(e.target.value)}>
                <option value="">Whole title (fallback for all episodes)</option>
                {episodes.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </label>
          )}
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
            {([["upload", "Upload"], ["asset", "Existing asset"], ["url", "Authorized URL"]] as const).map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-md px-2 py-1.5 ${mode === m ? "bg-background text-gold" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          {mode !== "url" ? (
            <>
              <label className="block text-sm">Provider
                <select className={field} value={provider} onChange={(e) => setProvider(e.target.value as "mux" | "cloudflare")}>
                  <option value="mux">Mux</option><option value="cloudflare">Cloudflare Stream</option>
                </select>
              </label>
              {mode === "upload"
                ? <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                : <input className={field} placeholder={provider === "mux" ? "Mux asset ID" : "Cloudflare video ID"} value={assetId} onChange={(e) => setAssetId(e.target.value.trim())} />}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} className="accent-[var(--gold)]" />Signed (private) playback</label>
            </>
          ) : (
            <>
              <select className={field} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="hls">HLS (.m3u8)</option><option value="dash">DASH (.mpd)</option><option value="mp4">MP4</option><option value="embed">Official embed</option>
              </select>
              <input className={field} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input className={field} placeholder="Language (ar, fr, en…)" value={language} onChange={(e) => setLanguage(e.target.value)} />
            <select className={field} value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="">Adaptive quality</option>{["360p", "480p", "720p", "1080p", "4K"].map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
          <input className={field} placeholder="Allowed countries, e.g. MA, FR (blank = everywhere)" value={countries} onChange={(e) => setCountries(e.target.value)} />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={isDubbed} onChange={(e) => setDubbed(e.target.checked)} className="accent-[var(--gold)]" />Dubbed</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={isDefault} onChange={(e) => setDefault(e.target.checked)} className="accent-[var(--gold)]" />Default</label>
          </div>
          <button disabled={submit.isPending || !titleId} onClick={() => submit.mutate()} className={mbButton({ className: "w-full" })}>
            {submit.isPending ? (pct != null ? `Uploading ${pct}%` : "Saving…") : mode === "upload" ? "Upload video" : "Add source"}
          </button>
        </section>

        <section className="min-w-0">
          {!titleId ? <EmptyState title="Pick a title" body="Its video sources will appear here." /> : sources.isLoading ? <StarLoader /> : (sources.data ?? []).length === 0 ? (
            <EmptyState title="No sources yet" body="Users see “Not currently available to watch” until one is ready." />
          ) : (
            <div className="space-y-3">
              {(sources.data ?? []).map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.is_active ? STATUS_TONE[s.status] : "default"}>{s.is_active ? s.status : "disabled"}</Badge>
                    <span className="font-medium">{s.provider} · {s.kind}</span>
                    <span className="text-xs text-muted-foreground">{s.episode_id ? episodes.find((e) => e.id === s.episode_id)?.label ?? "Episode" : "Whole title"}</span>
                    {s.language && <Badge>{s.language}{s.is_dubbed ? " dub" : ""}</Badge>}
                    {s.quality && <Badge>{s.quality}</Badge>}
                    {s.requires_signed_token && <Badge tone="gold">signed</Badge>}
                    {s.is_default && <Badge tone="gold">default</Badge>}
                  </div>
                  {s.error_message && <p className="mt-2 text-sm text-destructive">{s.error_message}</p>}
                  {(s.playback_errors ?? []).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{s.playback_errors.length} viewer error(s) · latest: {s.playback_errors[s.playback_errors.length - 1].message}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.status === "ready" && <button className={mbButton({ variant: "outline", size: "sm" })} onClick={async () => { try { setPreview(await previewFn({ data: { sourceId: s.id } })); } catch (e) { toast.error((e as Error).message); } }}>Preview</button>}
                    {(s.status === "uploading" || s.status === "processing") && <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => refreshFn({ data: { sourceId: s.id } }).then(reload)}>Check status</button>}
                    <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => update(s.id, { is_active: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button>
                    {!s.is_default && <button className={mbButton({ variant: "subtle", size: "sm" })} onClick={() => update(s.id, { is_default: true })}>Make default</button>}
                    <button className={mbButton({ variant: "ghost", size: "sm" })} onClick={() => remove(s.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
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

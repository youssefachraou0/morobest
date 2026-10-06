import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { titleQuery } from "@/features/catalog/queries";
import { authorizePlayback, reportPlaybackError } from "@/features/streaming/streaming.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { saveProgress, useProgress } from "@/features/library/useLibrary";
import { tr } from "@/features/catalog/localize";
import { Player } from "@/features/player/Player";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";

export const Route = createFileRoute("/watch/$slug")({
  validateSearch: (s: Record<string, unknown>): { ep?: string } => ({ ep: typeof s.ep === "string" ? s.ep : undefined }),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(titleQuery(params.slug));
    if (!d || d.kind === "manga") throw notFound();
    return { name: d.tr.en?.title ?? d.originalTitle };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Watch ${loaderData.name} · MOROBEST` : "Unavailable · MOROBEST" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => <FullPageMessage code="404" title="This title is not available right now." />,
  component: Watch,
});

function Watch() {
  const { slug } = Route.useParams();
  const { ep } = Route.useSearch();
  const { data: d } = useSuspenseQuery(titleQuery(slug));
  const { t, locale } = useI18n();
  const { activeProfile, maxAge } = useAuth();
  const progress = useProgress();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const episodes = useMemo(() => (d?.seasons ?? []).flatMap((s) => s.episodes.map((e) => ({ ...e, season: s.number }))), [d]);
  const current = episodes.length ? episodes.find((e) => e.id === ep) ?? episodes[0] : null;
  const idx = current ? episodes.indexOf(current) : -1;
  const next = idx >= 0 ? episodes[idx + 1] : undefined;
  const prev = idx > 0 ? episodes[idx - 1] : undefined;

  const src = useQuery({
    queryKey: ["playback", d?.id, current?.id ?? null, activeProfile?.id ?? null],
    enabled: !!d,
    queryFn: () => authorizePlayback({ data: { titleId: d!.id, episodeId: current?.id, profileId: activeProfile?.id } }),
    staleTime: 30 * 60_000,
    gcTime: 30 * 60_000,
  });
  const sources = src.data?.ok ? src.data.sources : [];
  const [srcIdx, setSrcIdx] = useState(0);
  useEffect(() => setSrcIdx(0), [current?.id]);
  const active = sources[srcIdx];
  const audioOptions = useMemo(() => {
    const seen = new Map<string, number>();
    sources.forEach((s, i) => { const k = `${s.language ?? "orig"}${s.isDubbed ? "-dub" : ""}`; if (!seen.has(k)) seen.set(k, i); });
    return Array.from(seen.entries()).map(([k, i]) => [String(i), `${(sources[i]!.language ?? "Original").toUpperCase()}${sources[i]!.isDubbed ? " (dub)" : ""}`] as [string, string]);
  }, [sources]);
  const onFatal = useCallback((message: string) => {
    if (active) reportPlaybackError({ data: { sourceId: active.id, message } }).catch(() => {});
    if (srcIdx + 1 < sources.length) { setSrcIdx(srcIdx + 1); return true; }
    return false;
  }, [active, srcIdx, sources.length]);

  const saved = (progress.data ?? []).find((p) => p.title_id === d?.id && (p.episode_id ?? null) === (current?.id ?? null));
  const pid = activeProfile?.id;
  const onProgress = useCallback(
    (pos: number, dur: number) => {
      if (!pid || !d) return;
      saveProgress(pid, d.id, current?.id ?? null, pos, dur).then(() => qc.invalidateQueries({ queryKey: ["me", "progress", pid] }));
    },
    [pid, d, current?.id, qc],
  );
  const goPrev = prev ? () => navigate({ to: "/watch/$slug", params: { slug }, search: { ep: prev.id } }) : undefined;
  const goNext = next ? () => navigate({ to: "/watch/$slug", params: { slug }, search: { ep: next.id } }) : undefined;

  if (!d) return null;
  if (maxAge != null && d.ageRating > maxAge) return <FullPageMessage title={t.error.unavailable} homeLabel={t.nav.home} />;
  const name = tr(d, locale).title;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-4 bg-gradient-to-b from-background/90 to-transparent p-4 sm:px-8">
        <Link to="/title/$slug" params={{ slug }} aria-label={t.action.back} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-foreground/10">
          <ArrowLeft className="h-6 w-6 rtl:rotate-180" />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-display text-xl">{name}</p>
          {current && <p className="text-xs text-muted-foreground">{t.label.season} {current.season} · {t.label.episode} {current.number} — {current.title}</p>}
        </div>
        {prev && (
          <Link to="/watch/$slug" params={{ slug }} search={{ ep: prev.id }} className="ms-auto hidden text-sm text-muted-foreground hover:text-gold sm:block">{t.action.prev}</Link>
        )}
      </div>
      {src.isLoading || progress.isLoading ? (
        <StarLoader className="h-full" />
      ) : !active ? (
        <FullPageMessage title={src.data?.reason === "forbidden" ? t.error.unavailable : "Not currently available to watch"} homeLabel={t.nav.home} />
      ) : active.kind === "embed" ? (
        <iframe src={active.url} title={name} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
      ) : (
        <Player
          key={`${current?.id ?? d.id}-${active.id}`}
          source={active}
          onPrev={goPrev}
          onFatal={onFatal}
          markers={current ? { introStart: current.intro_start_s, introEnd: current.intro_end_s, recapEnd: current.recap_end_s } : undefined}
          audioOptions={audioOptions}
          audio={String(srcIdx)}
          onAudio={(v) => setSrcIdx(Number(v))}
          title={name}
          startAt={saved && !saved.completed ? saved.position_s : 0}
          onProgress={onProgress}
          onNext={goNext}
          nextLabel={t.action.next}
          errorLabel={t.error.playback}
          retryLabel={t.action.retry}
        />
      )}
    </div>
  );
}

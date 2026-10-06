import { track } from "@/features/analytics/track";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Ban, Play, Share2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { tmdbDetailQuery, tmdbSeasonQuery } from "@/features/tmdb/tmdb.functions";
import { applyOverride, episodeAvailabilityQuery, overlayQuery } from "@/features/editorial/editorial.functions";
import { backdropSrcSet, posterSrcSet, tmdbImg } from "@/features/tmdb/image";
import type { TmdbType } from "@/features/tmdb/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Row } from "./Row";
import { Badge } from "./Cards";
import { mbButton } from "./Button";
import { StarDivider } from "./Brand";
import { TL, TmdbAttribution, TmdbPersonTile, TmdbPoster } from "./Tmdb";
import { cn } from "@/lib/utils";

const D = {
  cast: { en: "Cast", fr: "Distribution", ar: "طاقم التمثيل" },
  recs: { en: "Recommended", fr: "Recommandés", ar: "مقترحات" },
  similar: { en: "More like this", fr: "Similaires", ar: "مشابهة" },
  images: { en: "Images", fr: "Images", ar: "صور" },
  episodes: { en: "Episodes", fr: "Épisodes", ar: "الحلقات" },
  season: { en: "Season", fr: "Saison", ar: "الموسم" },
  play: { en: "Watch now", fr: "Regarder", ar: "شاهد الآن" },
  watch: { en: "Watch options", fr: "Options de visionnage", ar: "خيارات المشاهدة" },
} as const;

export function TmdbDetailPage({ type, id }: { type: TmdbType; id: number }) {
  const { locale } = useI18n();
  const { data: raw } = useSuspenseQuery(tmdbDetailQuery(type, id, locale));
  const { data: ov } = useSuspenseQuery(overlayQuery(type === "movie" ? "movie" : "series", id, locale));
  const [trailer, setTrailer] = useState(false);
  if (!raw) return null;
  const d = applyOverride(raw, ov.override);
  const link = ov.link;
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: d.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
  };
  const facts: [string, string | null | undefined][] = [
    ["Original title", d.originalTitle !== d.title ? d.originalTitle : null],
    [type === "movie" ? "Release" : "First aired", d.date],
    ["Runtime", d.runtime ? `${d.runtime} min` : null],
    ["Status", d.status],
    ["Seasons", type === "tv" ? String(d.seasons.filter((s) => s.number > 0).length) : null],
    ["Episodes", d.totalEpisodes ? String(d.totalEpisodes) : null],
    ["Countries", d.countries.map((c) => c.name).join(", ") || null],
    ["Original language", d.language?.toUpperCase()],
    ["Spoken", d.spokenLanguages.join(", ") || null],
    ["Director", d.directors.map((x) => x.name).join(", ") || null],
    ["Created by", d.creators.map((x) => x.name).join(", ") || null],
    ["Writers", d.writers.map((x) => x.name).join(", ") || null],
    ["Networks", d.networks.map((x) => x.name).join(", ") || null],
    ["Production", d.companies.map((x) => x.name).join(", ") || null],
    ["Votes", d.votes ? d.votes.toLocaleString(locale) : null],
    ["Popularity", d.popularity ? Math.round(d.popularity).toLocaleString(locale) : null],
    ["TMDB ID", String(d.tmdbId)],
  ];

  return (
    <div className="pb-10">
      <section className="relative min-h-[70vh] overflow-hidden">
        {d.backdrop && <img src={tmdbImg(d.backdrop, "w1280")!} srcSet={backdropSrcSet(d.backdrop)} sizes="100vw" alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent rtl:bg-gradient-to-l" />
        <div className="relative flex flex-col gap-8 px-4 pb-10 pt-32 sm:px-8 md:flex-row md:items-end lg:px-14">
          {d.poster && <img src={tmdbImg(d.poster, "w500")!} srcSet={posterSrcSet(d.poster)} sizes="240px" alt={d.title} className="w-44 shrink-0 rounded-xl shadow-poster ring-1 ring-gold/30 sm:w-60" />}
          <div className="max-w-3xl animate-fade-up">
            <nav className="mb-2 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-gold">MOROBEST</Link> / <Link to={type === "movie" ? "/movies" : "/series"} className="hover:text-gold">{type === "movie" ? TL.movies[locale] : TL.series[locale]}</Link> / {d.title}
            </nav>
            <h1 className="font-display text-4xl font-semibold sm:text-5xl">{d.title}</h1>
            {d.tagline && <p className="mt-1 italic text-muted-foreground">{d.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {d.rating != null && <span className="inline-flex items-center gap-1 font-semibold text-gold"><Star className="h-4 w-4 fill-current" />{d.rating.toFixed(1)}</span>}
              {d.year && <Badge>{d.year}</Badge>}
              {d.genres.map((g) => <Badge key={g.id} tone="gold">{g.name}</Badge>)}
            </div>
            {d.overview && <p className="mt-5 max-w-2xl leading-relaxed text-foreground/85">{d.overview}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              {link?.playable ? (
                <Link to="/watch/$slug" params={{ slug: link.slug }} className={mbButton()} onClick={() => track("watch_click", { ctx: "detail", props: { slug: link.slug } })}><Play />{D.play[locale]}</Link>
              ) : (
                <button disabled className={mbButton({ variant: "subtle" })}><Ban />{TL.noSource[locale]}</button>
              )}
              {d.trailer && <button onClick={() => setTrailer(true)} className={mbButton({ variant: "outline" })}><Play />Trailer</button>}
              <button onClick={share} className={mbButton({ variant: "glass" })}><Share2 />Share</button>
            </div>
          </div>
        </div>
      </section>

      {trailer && d.trailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setTrailer(false)}>
          <button className="absolute end-4 top-4 text-foreground" aria-label="Close"><X /></button>
          <iframe className="aspect-video w-full max-w-5xl rounded-xl" src={`https://www.youtube-nocookie.com/embed/${d.trailer}?autoplay=1`} title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}

      <section className="grid gap-x-10 gap-y-3 px-4 py-6 text-sm sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-14">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex gap-3 border-b border-border/60 py-2"><span className="w-36 shrink-0 text-muted-foreground">{k}</span><span>{v}</span></div>
        ))}
      </section>

      {type === "tv" && d.seasons.length > 0 && <Seasons id={d.tmdbId} seasons={d.seasons} />}

      {d.cast.length > 0 && <Row title={D.cast[locale]}>{d.cast.map((p) => <TmdbPersonTile key={p.id} p={p} />)}</Row>}
      {[...d.directors, ...d.creators].length > 0 && (
        <Row title={type === "movie" ? "Director" : "Creators"}>{[...d.directors, ...d.creators].map((p) => <TmdbPersonTile key={p.id + (p.role ?? "")} p={p} />)}</Row>
      )}
      {d.images.length > 1 && (
        <Row title={D.images[locale]}>
          {d.images.map((src) => <img key={src} src={tmdbImg(src, "w780")!} alt="" loading="lazy" className="aspect-video w-72 shrink-0 rounded-lg object-cover ring-1 ring-border sm:w-96" />)}
        </Row>
      )}
      {d.recommendations.length > 0 && <Row title={D.recs[locale]}>{d.recommendations.map((x) => <TmdbPoster key={x.tmdbId} item={x} ctx="rec" />)}</Row>}
      {d.similar.length > 0 && <Row title={D.similar[locale]}>{d.similar.map((x) => <TmdbPoster key={x.tmdbId} item={x} ctx="similar" />)}</Row>}
      <TmdbAttribution />
    </div>
  );
}

function Seasons({ id, seasons }: { id: number; seasons: { number: number; name: string; episodeCount: number }[] }) {
  const { locale } = useI18n();
  const first = seasons.find((s) => s.number > 0)?.number ?? seasons[0]?.number ?? 1;
  const [n, setN] = useState(first);
  const q = useQuery(tmdbSeasonQuery(id, n, locale));
  const av = useQuery(episodeAvailabilityQuery(id, n));
  return (
    <section className="px-4 py-6 sm:px-8 lg:px-14">
      <StarDivider className="mb-6" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-3xl font-semibold">{D.episodes[locale]}</h2>
        <select value={n} onChange={(e) => setN(Number(e.target.value))} aria-label={D.season[locale]} className="h-10 rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none">
          {seasons.map((s) => <option key={s.number} value={s.number}>{s.name} · {s.episodeCount}</option>)}
        </select>
      </div>
      {q.isLoading && <p className="text-muted-foreground">…</p>}
      {q.isError && <p className="text-muted-foreground">{TL.unavailable[locale]}</p>}
      <ol className="grid gap-4 md:grid-cols-2">
        {q.data?.episodes.map((e) => (
          <li key={e.id} className={cn("flex gap-4 rounded-xl border border-border bg-surface p-3")}>
            <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {e.still && <img src={tmdbImg(e.still, "w300")!} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="font-medium"><span className="text-gold">{e.number}.</span> {e.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {e.airDate && <span>{e.airDate}</span>}{e.runtime && <span>{e.runtime} min</span>}
                {e.rating != null && <span className="inline-flex items-center gap-0.5 text-gold"><Star className="h-3 w-3 fill-current" />{e.rating.toFixed(1)}</span>}
              </p>
              {e.overview && <p className="mt-1 line-clamp-3 text-sm text-foreground/75">{e.overview}</p>}
              {av.data?.slug && av.data.episodes[e.number]?.playable && (
                <Link to="/watch/$slug" params={{ slug: av.data.slug }} search={{ ep: av.data.episodes[e.number]!.episodeId }} onClick={() => track("watch_click", { episodeId: av.data!.episodes[e.number]!.episodeId, ctx: "episode" })} className={cn(mbButton({ size: "sm" }), "mt-2")}><Play />{D.play[locale]}</Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

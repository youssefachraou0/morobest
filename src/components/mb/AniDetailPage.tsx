import { track } from "@/features/analytics/track";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { applyOverride, overlayQuery } from "@/features/editorial/editorial.functions";
import { Ban, ExternalLink, Play, Share2, Star } from "lucide-react";
import { toast } from "sonner";
import { aniDetailQuery } from "@/features/anilist/anilist.functions";
import type { AniPerson, AniType } from "@/features/anilist/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Row } from "./Row";
import { Badge } from "./Cards";
import { mbButton } from "./Button";
import { AL, AniPoster, nice } from "./Ani";

function Face({ p, sub }: { p: AniPerson; sub?: string | null }) {
  return (
    <div className="w-28 shrink-0 text-center">
      <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-surface-2 ring-1 ring-gold/30">
        {p.image && <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium">{p.name}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{sub ?? nice(p.role)}</p>
    </div>
  );
}

export function AniDetailPage({ type, id }: { type: AniType; id: number }) {
  const { data: raw } = useSuspenseQuery(aniDetailQuery(type, id));
  const { locale } = useI18n();
  const { data: ov } = useSuspenseQuery(overlayQuery(type === "ANIME" ? "anime" : "manga", id, locale));
  const [trailer, setTrailer] = useState(false);
  if (!raw) return null;
  const d = applyOverride(raw, ov.override);
  const isAnime = type === "ANIME";
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: d.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
  };
  const facts: [string, string | number | null][] = [
    ["Format", nice(d.format)], ["Status", nice(d.status)],
    isAnime ? ["Episodes", d.episodeCount] : ["Chapters", d.chapters],
    isAnime ? ["Duration", d.duration ? `${d.duration} min` : null] : ["Volumes", d.volumes],
    ["Season", d.season ? `${nice(d.season)} ${d.year ?? ""}` : d.year],
    ["Start", d.startDate], ["End", d.endDate], ["Source", nice(d.source)],
    ["Popularity", d.popularity.toLocaleString()], ["Favourites", d.favourites.toLocaleString()],
    [isAnime ? "Studio" : "Origin", isAnime ? d.studios.map((s) => s.name).join(", ") : d.country],
  ];
  const ld = {
    "@context": "https://schema.org", "@type": isAnime ? "TVSeries" : "Book", name: d.title, alternateName: [d.originalTitle, d.nativeTitle].filter(Boolean),
    image: d.poster, description: d.synopsis?.slice(0, 300), genre: d.genres,
    ...(d.score ? { aggregateRating: { "@type": "AggregateRating", ratingValue: d.score, bestRating: 10, ratingCount: Math.max(1, d.popularity) } } : {}),
  };
  return (
    <div className="pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <section className="relative h-[46vh] min-h-[320px] overflow-hidden">
        {(d.backdrop ?? d.poster) && <img src={d.backdrop ?? d.poster!} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
      </section>
      <div className="relative -mt-40 flex flex-col gap-8 px-4 sm:px-8 md:flex-row lg:px-14">
        {d.poster && <img src={d.poster} alt={d.title} className="w-48 shrink-0 self-start rounded-xl shadow-poster ring-1 ring-gold/30 md:w-60" />}
        <div className="min-w-0 animate-fade-up">
          <nav className="mb-2 text-xs text-muted-foreground">MOROBEST / {isAnime ? "Anime" : "Manga"} / {d.title}</nav>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">{d.title}</h1>
          <p className="mt-1 text-muted-foreground">{[d.originalTitle !== d.title ? d.originalTitle : null, d.nativeTitle].filter(Boolean).join(" · ")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {d.score != null && <span className="inline-flex items-center gap-1 font-semibold text-gold"><Star className="h-4 w-4 fill-current" />{d.score.toFixed(1)}</span>}
            {d.genres.map((g) => <Badge key={g} tone="gold">{g}</Badge>)}
          </div>
          {d.nextEpisode && <p className="mt-3 text-sm text-gold">Episode {d.nextEpisode.episode} airs {new Date(d.nextEpisode.airingAt * 1000).toLocaleDateString(locale)}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {isAnime && ov.link?.playable ? (
              <Link to="/watch/$slug" params={{ slug: ov.link.slug }} className={mbButton()} onClick={() => track("watch_click", { ctx: "detail", props: { slug: ov.link.slug } })}><Play />Watch now</Link>
            ) : (
              <button disabled className={mbButton({ variant: "subtle" })} title={isAnime ? AL.noSource[locale] : AL.noReader[locale]}>
                {isAnime ? <Play /> : <Ban />}{isAnime ? AL.noSource[locale] : AL.noReader[locale]}
              </button>
            )}
            {d.trailer?.site === "youtube" && <button onClick={() => setTrailer(true)} className={mbButton({ variant: "outline" })}><Play />Trailer</button>}
            <button onClick={share} className={mbButton({ variant: "glass" })}><Share2 />Share</button>
            <a href={d.siteUrl} target="_blank" rel="noreferrer" className={mbButton({ variant: "ghost" })}><ExternalLink />AniList</a>
          </div>
          {d.synopsis && <p className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed text-foreground/85">{d.synopsis}</p>}
          <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {facts.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
              <div key={k}><dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {d.tags.length > 0 && <div className="mt-4 flex max-w-3xl flex-wrap gap-1.5">{d.tags.map((t) => <Badge key={t.name}>{t.name}</Badge>)}</div>}
        </div>
      </div>
      {trailer && d.trailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setTrailer(false)}>
          <iframe className="aspect-video w-full max-w-4xl rounded-xl" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.trailer.id)}?autoplay=1`} title="Trailer" allow="autoplay; encrypted-media" allowFullScreen />
        </div>
      )}
      <div className="mt-8">
        {d.characters.length > 0 && (
          <Row title="Characters">
            {d.characters.map((c) => (
              <div key={c.id} className="flex shrink-0 gap-2">
                <Face p={c} />
                {c.voiceActor && <Face p={c.voiceActor} sub="Voice (JP)" />}
              </div>
            ))}
          </Row>
        )}
        {d.staff.length > 0 && <Row title="Staff">{d.staff.map((s, i) => <Face key={`${s.id}-${i}`} p={s} sub={s.role} />)}</Row>}
        {d.relations.length > 0 && (
          <Row title="Related">
            {d.relations.map((r) => (
              <div key={r.aniListId} className="relative">
                <span className="absolute end-2 top-2 z-10"><Badge tone="gold">{nice(r.relation)}</Badge></span>
                <AniPoster item={r} ctx="related" />
              </div>
            ))}
          </Row>
        )}
        {d.recommendations.length > 0 && <Row title="Recommendations">{d.recommendations.map((r) => <AniPoster key={r.aniListId} item={r} ctx="rec" />)}</Row>}
        {d.externalLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 sm:px-8 lg:px-14">
            {d.externalLinks.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer nofollow" className={mbButton({ variant: "subtle", size: "sm" })}>{l.site}</a>)}
          </div>
        )}
        <p className="px-4 pt-6 text-xs text-muted-foreground sm:px-8 lg:px-14">{AL.source[locale]}</p>
      </div>
    </div>
  );
}

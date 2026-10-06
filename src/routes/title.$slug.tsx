import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { fetchPlayable, fetchPlayableStaff } from "@/features/streaming/streaming.functions";
import { Bookmark, BookmarkCheck, Heart, Play, Share2, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { titleQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLibrary, useProgress } from "@/features/library/useLibrary";
import { tr, nameOf, ageLabel } from "@/features/catalog/localize";
import { Row } from "@/components/mb/Row";
import { Badge, EpisodeCard, PersonCard, PosterCard } from "@/components/mb/Cards";
import { mbButton } from "@/components/mb/Button";
import { FullPageMessage, EmptyState } from "@/components/mb/States";
import { StarDivider } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/title/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(titleQuery(params.slug));
    if (!d) throw notFound();
    return { name: d.tr.en?.title ?? d.originalTitle, synopsis: d.tr.en?.synopsis ?? "", year: d.year, kind: d.kind };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(`${loaderData.name}${loaderData.year ? ` (${loaderData.year})` : ""}`, loaderData.synopsis || `Watch ${loaderData.name} on MOROBEST.`)
      : { meta: [{ title: "Unavailable · MOROBEST" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <FullPageMessage code="404" title="This title is not available right now." />,
  component: TitlePage,
});

function TitlePage() {
  const { slug } = Route.useParams();
  const { data: d } = useSuspenseQuery(titleQuery(slug));
  const { t, locale } = useI18n();
  const { user, maxAge, canManageMedia } = useAuth();
  const lib = useLibrary();
  const progress = useProgress();
  const [seasonIdx, setSeasonIdx] = useState(0);
  const playable = useQuery({ queryKey: ["playable", d?.id, canManageMedia], enabled: !!d, queryFn: () => (canManageMedia ? fetchPlayableStaff : fetchPlayable)({ data: { titleId: d!.id } }), staleTime: 60_000 });
  if (!d) return null;

  if (maxAge != null && d.ageRating > maxAge) {
    return <div className="pt-32"><EmptyState title={t.error.unavailable} /></div>;
  }

  const l = tr(d, locale);
  const inList = lib.watchlist.includes(d.id);
  const fav = lib.favorites.includes(d.id);
  const isManga = d.kind === "manga";
  const season = d.seasons[seasonIdx];
  const myProgress = (progress.data ?? []).filter((p) => p.title_id === d.id);
  const resume = myProgress.find((p) => !p.completed && p.duration_s > 0 && p.position_s / p.duration_s > 0.05);
  const directors = d.credits.filter((c) => c.role !== "actor");

  const requireUser = (fn: () => void) => () => {
    if (!user) return toast(t.action.signIn, { description: t.auth.subtitle });
    fn();
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: l.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast(t.action.copied); }
  };

  return (
    <article>
      <section className="relative min-h-[78vh] overflow-hidden">
        {d.backdrop && <img src={d.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover animate-slow-zoom" />}
        <div className="absolute inset-0 bg-hero-side" />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="relative flex min-h-[78vh] flex-col items-start gap-8 px-4 pb-12 pt-28 sm:px-8 md:flex-row md:items-end lg:px-14">
          {d.poster && (
            <img src={d.poster} alt={l.title} width={768} height={1152} className="hidden w-56 shrink-0 rounded-xl shadow-poster ring-1 ring-gold/30 md:block lg:w-64" />
          )}
          <div className="max-w-2xl animate-fade-up">
            <div className="flex flex-wrap gap-2">
              <Badge tone="gold">{d.format ?? d.kind}</Badge>
              {d.status === "airing" && <Badge tone="red">{t.label.airing}</Badge>}
              {d.isKids && <Badge tone="green">{t.nav.kids}</Badge>}
            </div>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-none sm:text-7xl">{l.title}</h1>
            {l.title !== d.originalTitle && <p className="mt-2 text-muted-foreground">{d.originalTitle}</p>}
            {l.tagline && <p className="mt-3 font-display text-xl italic text-gold">{l.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/80">
              {d.rating && <span className="inline-flex items-center gap-1 text-gold"><Star className="h-4 w-4 fill-current" />{d.rating.toFixed(1)}</span>}
              {d.year && <span>{d.year}</span>}
              <Badge>{ageLabel(d.ageRating)}</Badge>
              {d.runtime && <span>{d.runtime} {t.label.min}</span>}
              {d.seasons.length > 0 && <span>{d.seasons.length} {t.label.season}</span>}
              {d.genres.map((g) => nameOf(g, locale)).join(" · ")}
            </div>
            {l.synopsis && <p className="mt-5 text-lg text-foreground/85">{l.synopsis}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              {!isManga && playable.data && !playable.data.whole && playable.data.episodes.length === 0 && (
                <span className={mbButton({ variant: "subtle", size: "lg", className: "pointer-events-none opacity-70" })}>Not currently available to watch</span>
              )}
              {!isManga && (playable.data?.whole || (playable.data?.episodes.length ?? 0) > 0) && (
                <Link to="/watch/$slug" params={{ slug: d.slug }} search={resume?.episode_id ? { ep: resume.episode_id } : !playable.data?.whole && playable.data?.episodes[0] ? { ep: playable.data.episodes[0] } : {}} className={mbButton({ size: "lg" })}>
                  <Play className="fill-current" />{resume ? t.action.continue : t.action.play}{playable.data?.testOnly ? " · TEST VIDEO" : ""}
                </Link>
              )}
              <button onClick={requireUser(() => lib.toggle({ table: "watchlist", titleId: d.id, on: !inList }))} className={mbButton({ variant: "glass", size: "lg" })} aria-pressed={inList}>
                {inList ? <BookmarkCheck className="text-gold" /> : <Bookmark />}{inList ? t.action.inList : t.action.addList}
              </button>
              <button onClick={requireUser(() => lib.toggle({ table: "favorites", titleId: d.id, on: !fav }))} aria-label={t.action.favorite} aria-pressed={fav} className={mbButton({ variant: "glass", size: "icon" })}>
                <Heart className={cn(fav && "fill-destructive text-destructive")} />
              </button>
              <button onClick={share} aria-label={t.action.share} className={mbButton({ variant: "glass", size: "icon" })}><Share2 /></button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_320px] lg:px-14">
        <div className="min-w-0">
          {d.seasons.length > 0 && (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-3xl font-semibold">{t.section.episodes}</h2>
                {d.seasons.length > 1 && (
                  <select value={seasonIdx} onChange={(e) => setSeasonIdx(Number(e.target.value))} className="rounded-md border border-input bg-surface px-3 py-2" aria-label={t.label.season}>
                    {d.seasons.map((s, i) => <option key={s.id} value={i}>{t.label.season} {s.number}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-1">
                {season?.episodes.map((ep) => {
                  const p = myProgress.find((x) => x.episode_id === ep.id);
                  return <EpisodeCard key={ep.id} ep={ep} slug={d.slug} progress={p && p.duration_s ? p.position_s / p.duration_s : undefined} />;
                })}
              </div>
            </section>
          )}

          {isManga && (
            <section>
              <h2 className="mb-2 font-display text-3xl font-semibold">{t.section.volumes}</h2>
              <p className="mb-5 text-sm text-muted-foreground">{t.label.catalogOnly}</p>
              <div className="space-y-6">
                {d.volumes.map((v) => (
                  <div key={v.id} className="rounded-xl border border-border bg-surface p-4">
                    <p className="font-display text-xl text-gold">{t.label.volume} {v.number}</p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {v.chapters.map((c) => (
                        <li key={c.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                          <span>{c.title ?? `${t.label.chapter} ${c.number}`}</span>
                          {c.official_url ? (
                            <a href={c.official_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold"><ExternalLink className="h-3.5 w-3.5" />{t.action.read}</a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{c.release_date}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {d.credits.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-display text-3xl font-semibold">{t.section.cast}</h2>
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                {d.credits.map((c, i) => (
                  <PersonCard key={i} name={locale === "ar" && c.person.name_ar ? c.person.name_ar : c.person.name} role={c.character ?? c.role} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-6 text-sm">
          {directors.map((c, i) => (
            <Info key={i} label={c.role === "director" ? t.label.director : c.role === "author" ? t.label.author : t.label.creator} value={c.person.name} />
          ))}
          {d.studio && <Info label={t.label.studio} value={d.studio.name} />}
          {d.countries.length > 0 && (
            <div>
              <p className="eyebrow mb-1">{t.label.countries}</p>
              <div className="flex flex-wrap gap-2">
                {d.countries.map((c) =>
                  c.is_arab ? (
                    <Link key={c.code} to="/arabic/$country" params={{ country: c.slug }} className="text-foreground hover:text-gold">{nameOf(c, locale)}</Link>
                  ) : (
                    <span key={c.code}>{nameOf(c, locale)}</span>
                  ),
                )}
              </div>
            </div>
          )}
          {d.languages.length > 0 && <Info label={t.label.languages} value={d.languages.map((x) => nameOf({ ...x, slug: x.code }, locale)).join(", ")} />}
          {d.releaseDate && <Info label={t.label.released} value={d.releaseDate} />}
          <Info label={t.label.age} value={ageLabel(d.ageRating)} />
        </aside>
      </div>

      {d.related.length > 0 && (
        <Row title={t.section.related}>{d.related.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
      )}
      {d.similar.length > 0 && (
        <>
          <StarDivider className="mx-4 my-4 sm:mx-8 lg:mx-14" />
          <Row title={t.section.similar}>{d.similar.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
        </>
      )}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow mb-1">{label}</p>
      <p>{value}</p>
    </div>
  );
}

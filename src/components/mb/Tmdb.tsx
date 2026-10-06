import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Info, Star } from "lucide-react";
import { fetchTmdbDiscover, fetchTmdbGenres, tmdbWorldQuery, type DiscoverInput, type WorldKind } from "@/features/tmdb/tmdb.functions";
import { backdropSrcSet, posterSrcSet, tmdbImg } from "@/features/tmdb/image";
import type { TmdbCard, TmdbPersonCard, TmdbRow, TmdbType } from "@/features/tmdb/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Row } from "./Row";
import { Badge, PosterSkeleton } from "./Cards";
import { mbButton } from "./Button";
import { EmptyState } from "./States";
import { cn } from "@/lib/utils";
import { contentKey, useCanonical } from "@/features/editorial/canonical";
import { track, useImpression } from "@/features/analytics/track";

type L3 = { en: string; fr: string; ar: string };
const L: Record<string, L3> = {
  trendingAll: { en: "Trending today", fr: "Tendances du jour", ar: "الأكثر رواجاً اليوم" },
  trendingMovies: { en: "Trending movies", fr: "Films tendance", ar: "أفلام رائجة" },
  trendingTv: { en: "Trending series", fr: "Séries tendance", ar: "مسلسلات رائجة" },
  popularMovies: { en: "Popular movies", fr: "Films populaires", ar: "أفلام شائعة" },
  popularTv: { en: "Popular series", fr: "Séries populaires", ar: "مسلسلات شائعة" },
  topMovies: { en: "Top rated movies", fr: "Films les mieux notés", ar: "الأفلام الأعلى تقييماً" },
  topTv: { en: "Top rated series", fr: "Séries les mieux notées", ar: "المسلسلات الأعلى تقييماً" },
  nowPlaying: { en: "Now in cinemas", fr: "Actuellement au cinéma", ar: "في السينما الآن" },
  upcoming: { en: "Coming soon", fr: "Prochainement", ar: "قريباً" },
  newMovies: { en: "New releases", fr: "Nouveautés", ar: "إصدارات جديدة" },
  newTv: { en: "New series", fr: "Nouvelles séries", ar: "مسلسلات جديدة" },
  airingTv: { en: "Currently airing", fr: "En cours de diffusion", ar: "يُعرض حالياً" },
  classicMovies: { en: "Classics", fr: "Classiques", ar: "كلاسيكيات" },
  classicArabic: { en: "Arabic classics", fr: "Classiques arabes", ar: "كلاسيكيات عربية" },
  classicGolden: { en: "Golden age", fr: "Âge d'or", ar: "العصر الذهبي" },
  classicTv: { en: "Classic series", fr: "Séries cultes", ar: "مسلسلات خالدة" },
  arabicMovies: { en: "Arabic cinema", fr: "Cinéma arabe", ar: "السينما العربية" },
  arabicTv: { en: "Arabic series", fr: "Séries arabes", ar: "المسلسلات العربية" },
  arabicTop: { en: "Top rated Arabic films", fr: "Films arabes les mieux notés", ar: "أفضل الأفلام العربية" },
  arabicNew: { en: "New Arabic releases", fr: "Nouveautés arabes", ar: "جديد السينما العربية" },
  moroccan: { en: "Moroccan cinema", fr: "Cinéma marocain", ar: "السينما المغربية" },
  kidsMovies: { en: "Kids movies", fr: "Films pour enfants", ar: "أفلام الأطفال" },
  animatedMovies: { en: "Animated movies", fr: "Films d'animation", ar: "أفلام الرسوم المتحركة" },
  familyMovies: { en: "Family adventures", fr: "Aventures en famille", ar: "مغامرات عائلية" },
  kidsTv: { en: "Kids TV", fr: "Séries jeunesse", ar: "برامج الأطفال" },
  animationTv: { en: "Animation series", fr: "Séries animées", ar: "مسلسلات كرتون" },
  country_featured: { en: "Most popular", fr: "Les plus populaires", ar: "الأكثر شعبية" },
  country_movies: { en: "Popular movies", fr: "Films populaires", ar: "أفلام شائعة" },
  country_series: { en: "Popular series", fr: "Séries populaires", ar: "مسلسلات شائعة" },
  country_new: { en: "New movies", fr: "Nouveaux films", ar: "أفلام جديدة" },
  country_newtv: { en: "New series", fr: "Nouvelles séries", ar: "مسلسلات جديدة" },
  country_top: { en: "Top rated", fr: "Les mieux notés", ar: "الأعلى تقييماً" },
  country_classic: { en: "Classics", fr: "Classiques", ar: "كلاسيكيات" },
};
export const TL = {
  source: { en: "Movie & TV metadata from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.", fr: "Données films et séries : TMDB. Ce produit utilise l'API TMDB sans être approuvé par TMDB.", ar: "بيانات الأفلام والمسلسلات من TMDB. يستخدم هذا المنتج واجهة TMDB دون أن يكون معتمداً منها." },
  noSource: { en: "Not available to stream on MOROBEST yet", fr: "Pas encore disponible en streaming sur MOROBEST", ar: "غير متاح للمشاهدة على MOROBEST بعد" },
  loadMore: { en: "Load more", fr: "Voir plus", ar: "المزيد" },
  explore: { en: "Explore", fr: "Explorer", ar: "استكشف" },
  allGenres: { en: "All genres", fr: "Tous les genres", ar: "كل الأنواع" },
  movies: { en: "Movies", fr: "Films", ar: "أفلام" },
  series: { en: "Series", fr: "Séries", ar: "مسلسلات" },
  people: { en: "People", fr: "Personnalités", ar: "أشخاص" },
  details: { en: "Details", fr: "Détails", ar: "التفاصيل" },
  unavailable: { en: "The catalog is temporarily unavailable. Please try again shortly.", fr: "Catalogue momentanément indisponible.", ar: "الكتالوج غير متاح مؤقتاً." },
} satisfies Record<string, L3>;
export const rowLabel = (k: string, l: keyof L3) => L[k]?.[l] ?? k;

export function TmdbPoster({ item, className, rank, ctx, onPick }: { item: TmdbCard; className?: string; rank?: number; ctx?: string; onPick?: () => void }) {
  const canonical = useCanonical();
  const kind = item.type === "movie" ? "movie" : "series";
  const key = contentKey(kind, item.tmdbId);
  const ref = useImpression<HTMLAnchorElement>(`${ctx ?? "row"}:${key}`, () => track("impression", { key, ctx: ctx ?? "row" }));
  return (
    <Link ref={ref} {...canonical({ kind, providerId: item.tmdbId, slug: item.slug })} onClick={() => { track("click", { key, ctx: ctx ?? "row" }); onPick?.(); }} className={cn("group relative block w-[136px] shrink-0 sm:w-[168px] lg:w-[184px]", className)}>
      {rank && <span className="pointer-events-none absolute -start-3 bottom-6 z-10 font-display text-7xl font-bold text-gold/80 drop-shadow-lg">{rank}</span>}
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 shadow-poster ring-1 ring-foreground/10 transition-all duration-500 group-hover:-translate-y-1 group-hover:ring-gold/60">
        {item.poster ? (
          <img src={tmdbImg(item.poster, "w342")!} srcSet={posterSrcSet(item.poster)} sizes="(min-width:1024px) 184px, (min-width:640px) 168px, 136px" alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center font-display text-lg text-muted-foreground">{item.title}</div>
        )}
        <div className="absolute inset-0 bg-card-fade opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute start-2 top-2"><Badge>{item.type === "tv" ? "TV" : "Film"}</Badge></div>
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 text-[11px] text-foreground/80">
            {item.rating != null && <span className="inline-flex items-center gap-0.5 text-gold"><Star className="h-3 w-3 fill-current" />{item.rating.toFixed(1)}</span>}
            {item.year && <span>{item.year}</span>}
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground/85 group-hover:text-gold">{item.title}</p>
    </Link>
  );
}

export function TmdbPersonTile({ p }: { p: TmdbPersonCard }) {
  return (
    <Link to="/person/$slug" params={{ slug: p.slug }} className="group w-28 shrink-0 text-center sm:w-32">
      <div className="mx-auto aspect-square w-24 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border transition group-hover:ring-gold/60 sm:w-28">
        {p.photo && <img src={tmdbImg(p.photo, "w185")!} alt={p.name} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium group-hover:text-gold">{p.name}</p>
      {p.role && <p className="line-clamp-1 text-xs text-muted-foreground">{p.role}</p>}
    </Link>
  );
}

export function TmdbHero({ items }: { items: TmdbCard[] }) {
  const { locale } = useI18n();
  const canonical = useCanonical();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % items.length), 8000);
    return () => clearInterval(id);
  }, [items.length]);
  const h = items[i];
  if (!h) return <div className="h-28" />;
  return (
    <section className="relative h-[78vh] min-h-[540px] overflow-hidden" aria-roledescription="carousel">
      {items.map((x, k) => (
        <img key={x.type + x.tmdbId} src={tmdbImg(x.backdrop, "w1280")!} srcSet={backdropSrcSet(x.backdrop)} sizes="100vw" alt="" aria-hidden={k !== i}
          loading={k === 0 ? "eager" : "lazy"} className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000", k === i ? "opacity-100" : "opacity-0")} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent rtl:bg-gradient-to-l" />
      <div className="relative flex h-full items-end px-4 pb-28 sm:px-8 lg:px-14">
        <div key={h.type + h.tmdbId} className="max-w-2xl animate-fade-up">
          <div className="mb-3 flex gap-2"><Badge tone="gold">{h.type === "tv" ? TL.series[locale] : TL.movies[locale]}</Badge>{h.year && <Badge>{h.year}</Badge>}
            {h.rating != null && <Badge><Star className="me-1 inline h-3 w-3 fill-current text-gold" />{h.rating.toFixed(1)}</Badge>}</div>
          <h1 className="font-display text-4xl font-semibold sm:text-6xl">{h.title}</h1>
          {h.originalTitle !== h.title && <p className="mt-1 text-muted-foreground">{h.originalTitle}</p>}
          {h.overview && <p className="mt-4 line-clamp-3 text-foreground/80">{h.overview}</p>}
          <Link {...canonical({ kind: h.type === "movie" ? "movie" : "series", providerId: h.tmdbId, slug: h.slug })} onClick={() => track("click", { key: contentKey(h.type === "movie" ? "movie" : "series", h.tmdbId), ctx: "hero" })} className={mbButton({ className: "mt-6" })}><Info />{TL.details[locale]}</Link>
          <div className="mt-6 flex gap-1.5">
            {items.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={cn("h-1 rounded-full transition-all", k === i ? "w-8 bg-gold" : "w-3 bg-foreground/30")} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TmdbRows({ rows, rankFirst }: { rows: TmdbRow[]; rankFirst?: boolean }) {
  const { locale } = useI18n();
  return (
    <>
      {rows.map((r, idx) => (
        <Row key={r.key} title={rowLabel(r.key, locale)}>
          {r.items.map((x, i) => <TmdbPoster key={x.type + x.tmdbId} item={x} rank={rankFirst && idx === 0 && i < 10 ? i + 1 : undefined} className={rankFirst && idx === 0 && i < 10 ? "ms-6" : undefined} />)}
        </Row>
      ))}
    </>
  );
}

export function TmdbWorldView({ kind, title, eyebrow, grid, kids }: { kind: WorldKind; title?: string; eyebrow?: string; grid?: TmdbType; kids?: boolean }) {
  const { locale } = useI18n();
  const { data } = useSuspenseQuery(tmdbWorldQuery(kind, locale, kids));
  return (
    <div className="pb-10">
      <TmdbHero items={data.hero} />
      <div className="relative -mt-20">
        {title && <div className="px-4 pb-2 sm:px-8 lg:px-14">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="sr-only">{title}</h1></div>}
        <TmdbRows rows={data.rows} rankFirst={kind === "trending"} />
      </div>
      {grid && <TmdbGrid type={grid} kids={kids || kind === "kids"} />}
      <TmdbAttribution />
    </div>
  );
}

export function TmdbAttribution() {
  const { locale } = useI18n();
  return <p className="px-4 pt-6 text-xs text-muted-foreground sm:px-8 lg:px-14">{TL.source[locale]}</p>;
}

export function TmdbGrid({ type, kids, country, initialGenre }: { type: TmdbType; kids?: boolean; country?: string; initialGenre?: string }) {
  const { locale } = useI18n();
  const [genres, setGenres] = useState<string | undefined>(initialGenre);
  const [sort, setSort] = useState<DiscoverInput["sort"]>("popularity.desc");
  const [year, setYear] = useState<number | undefined>();
  const gl = useQuery({ queryKey: ["tmdb-genres", type, locale], queryFn: () => fetchTmdbGenres({ data: { type, locale } }), staleTime: 24 * 3600_000 });
  const params: DiscoverInput = { type, locale, sort, genres, year, country, kids };
  const q = useInfiniteQuery({
    queryKey: ["tmdb-grid", params],
    queryFn: ({ pageParam }) => fetchTmdbDiscover({ data: { ...params, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.hasNext ? p.page + 1 : undefined),
    staleTime: 10 * 60_000,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const sel = "h-10 rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i);
  return (
    <section className="px-4 pt-10 sm:px-8 lg:px-14">
      <h2 className="mb-4 font-display text-3xl font-semibold">{TL.explore[locale]}</h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {!kids && (
          <select className={sel} value={genres ?? ""} onChange={(e) => setGenres(e.target.value || undefined)} aria-label="Genre">
            <option value="">{TL.allGenres[locale]}</option>
            {(gl.data ?? []).map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
          </select>
        )}
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as DiscoverInput["sort"])} aria-label="Sort">
          <option value="popularity.desc">Popular</option>
          <option value="vote_average.desc">Top rated</option>
          <option value={type === "movie" ? "primary_release_date.desc" : "first_air_date.desc"}>Newest</option>
        </select>
        <select className={sel} value={year ?? ""} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)} aria-label="Year">
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)}</div>
      ) : q.isError ? (
        <EmptyState title={TL.unavailable[locale]} />
      ) : items.length === 0 ? (
        <EmptyState title="—" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 [&>a]:w-full">
          {items.map((x) => <TmdbPoster key={x.type + x.tmdbId} item={x} />)}
        </div>
      )}
      {q.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className={mbButton({ variant: "outline" })}>{TL.loadMore[locale]}</button>
        </div>
      )}
    </section>
  );
}

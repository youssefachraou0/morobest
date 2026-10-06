import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Star, Info } from "lucide-react";
import { aniHomeQuery, fetchAniBrowse } from "@/features/anilist/anilist.functions";
import type { AniBrowse, AniCard, AniType } from "@/features/anilist/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Row } from "./Row";
import { Badge, PosterSkeleton } from "./Cards";
import { mbButton } from "./Button";
import { EmptyState } from "./States";
import { cn } from "@/lib/utils";

type L3 = { en: string; fr: string; ar: string };
const ROW_LABELS: Record<string, L3> = {
  trending: { en: "Trending now", fr: "Tendances", ar: "الأكثر رواجاً" },
  airing: { en: "Currently airing", fr: "En cours de diffusion", ar: "يُعرض حالياً" },
  popular: { en: "Most popular", fr: "Les plus populaires", ar: "الأكثر شعبية" },
  top: { en: "Top rated", fr: "Les mieux notés", ar: "الأعلى تقييماً" },
  upcoming: { en: "Upcoming", fr: "Bientôt", ar: "قريباً" },
  movies: { en: "Anime movies", fr: "Films d'animation", ar: "أفلام الأنمي" },
  classic: { en: "Timeless classics", fr: "Classiques", ar: "كلاسيكيات" },
  ongoing: { en: "Ongoing", fr: "En cours", ar: "مستمرة" },
  completed: { en: "Completed", fr: "Terminés", ar: "مكتملة" },
  manhwa: { en: "Manhwa", fr: "Manhwa", ar: "مانهوا" },
  manhua: { en: "Manhua", fr: "Manhua", ar: "مانهوا صينية" },
};
export const aniLabel = (key: string, locale: "en" | "fr" | "ar") => ROW_LABELS[key]?.[locale] ?? key;
export const AL = {
  noSource: { en: "Not available to stream on MOROBEST yet", fr: "Pas encore disponible en streaming sur MOROBEST", ar: "غير متاح للمشاهدة على MOROBEST بعد" },
  noReader: { en: "Reading not available on MOROBEST yet", fr: "Lecture pas encore disponible sur MOROBEST", ar: "القراءة غير متاحة على MOROBEST بعد" },
  loadMore: { en: "Load more", fr: "Voir plus", ar: "المزيد" },
  source: { en: "Metadata from AniList", fr: "Données AniList", ar: "البيانات من AniList" },
  unavailable: { en: "The catalog is temporarily unavailable. Please try again shortly.", fr: "Catalogue momentanément indisponible.", ar: "الكتالوج غير متاح مؤقتاً." },
} satisfies Record<string, L3>;

const nice = (s: string | null) => (s ? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "");
export { nice };

export function AniPoster({ item, className }: { item: AniCard; className?: string }) {
  const to = item.type === "ANIME" ? "/anime/$slug" : "/manga/$slug";
  return (
    <Link to={to} params={{ slug: item.slug }} className={cn("group relative block w-[136px] shrink-0 sm:w-[168px] lg:w-[184px]", className)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 shadow-poster ring-1 ring-foreground/10 transition-all duration-500 group-hover:-translate-y-1 group-hover:ring-gold/60">
        {item.poster && <img src={item.poster} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />}
        <div className="absolute inset-0 bg-card-fade opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute start-2 top-2 flex gap-1">
          {item.status === "RELEASING" && <Badge tone="red">{item.type === "ANIME" ? "Airing" : "Ongoing"}</Badge>}
          {item.format && <Badge>{nice(item.format)}</Badge>}
        </div>
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 text-[11px] text-foreground/80">
            {item.score != null && <span className="inline-flex items-center gap-0.5 text-gold"><Star className="h-3 w-3 fill-current" />{item.score.toFixed(1)}</span>}
            {item.year && <span>{item.year}</span>}
            {item.episodeCount && <span>{item.episodeCount} ep</span>}
            {item.chapters && <span>{item.chapters} ch</span>}
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground/85 group-hover:text-gold">{item.title}</p>
    </Link>
  );
}

function AniHero({ items }: { items: AniCard[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % items.length), 8000);
    return () => clearInterval(id);
  }, [items.length]);
  const h = items[i];
  if (!h) return null;
  const to = h.type === "ANIME" ? "/anime/$slug" : "/manga/$slug";
  return (
    <section className="relative h-[72vh] min-h-[520px] overflow-hidden">
      {items.map((x, k) => (
        <img key={x.aniListId} src={x.backdrop!} alt="" className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000", k === i ? "opacity-100" : "opacity-0")} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent rtl:bg-gradient-to-l" />
      <div className="relative flex h-full items-end gap-6 px-4 pb-14 sm:px-8 lg:px-14">
        {h.poster && <img src={h.poster} alt="" className="hidden w-44 rounded-lg shadow-poster ring-1 ring-gold/30 md:block" />}
        <div key={h.aniListId} className="max-w-2xl animate-fade-up">
          <div className="mb-3 flex flex-wrap gap-2">{h.genres.slice(0, 3).map((g) => <Badge key={g} tone="gold">{g}</Badge>)}</div>
          <h1 className="font-display text-4xl font-semibold sm:text-6xl">{h.title}</h1>
          {h.nativeTitle && <p className="mt-1 text-muted-foreground">{h.nativeTitle}</p>}
          {h.synopsis && <p className="mt-4 line-clamp-3 text-foreground/80">{h.synopsis}</p>}
          <Link to={to} params={{ slug: h.slug }} className={mbButton({ className: "mt-6" })}><Info />Details</Link>
        </div>
      </div>
    </section>
  );
}

export function AniWorld({ type }: { type: AniType }) {
  const { data } = useSuspenseQuery(aniHomeQuery(type));
  const { locale } = useI18n();
  return (
    <div className="pb-10">
      <AniHero items={data.hero} />
      <div className="-mt-6 relative">
        {data.rows.map((r) => (
          <Row key={r.key} title={aniLabel(r.key, locale)}>{r.items.map((x) => <AniPoster key={x.aniListId} item={x} />)}</Row>
        ))}
      </div>
      <AniGrid type={type} />
      <p className="px-4 pt-6 text-xs text-muted-foreground sm:px-8 lg:px-14">{AL.source[locale]}</p>
    </div>
  );
}

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];

export function AniGrid({ type }: { type: AniType }) {
  const { locale } = useI18n();
  const [f, setF] = useState<Omit<AniBrowse, "type" | "page">>({ sort: "POPULARITY_DESC" });
  const params = { type, ...f };
  const q = useInfiniteQuery({
    queryKey: ["al-grid", params],
    queryFn: ({ pageParam }) => fetchAniBrowse({ data: { ...params, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext && last.page < 20 ? last.page + 1 : undefined),
    staleTime: 10 * 60_000,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q]);
  const sel = "h-10 rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
  const year = new Date().getFullYear();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const formats = type === "ANIME" ? ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"] : ["MANGA", "NOVEL", "ONE_SHOT"];
  return (
    <section className="px-4 pt-8 sm:px-8 lg:px-14">
      <h2 className="font-display text-3xl font-semibold">{type === "ANIME" ? "Explore anime" : "Explore manga"}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <select aria-label="Sort" className={sel} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as AniBrowse["sort"] })}>
          <option value="POPULARITY_DESC">{aniLabel("popular", locale)}</option>
          <option value="TRENDING_DESC">{aniLabel("trending", locale)}</option>
          <option value="SCORE_DESC">{aniLabel("top", locale)}</option>
          <option value="START_DATE_DESC">Newest</option>
        </select>
        <select aria-label="Genre" className={sel} value={f.genre ?? ""} onChange={(e) => setF({ ...f, genre: e.target.value || undefined })}>
          <option value="">All genres</option>{GENRES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select aria-label="Format" className={sel} value={f.format ?? ""} onChange={(e) => setF({ ...f, format: e.target.value || undefined })}>
          <option value="">All formats</option>{formats.map((g) => <option key={g} value={g}>{nice(g)}</option>)}
        </select>
        {type === "MANGA" && (
          <select aria-label="Type" className={sel} value={f.country ?? ""} onChange={(e) => setF({ ...f, country: (e.target.value || undefined) as AniBrowse["country"] })}>
            <option value="">Manga · Manhwa · Manhua</option><option value="JP">Manga</option><option value="KR">Manhwa</option><option value="CN">Manhua</option>
          </select>
        )}
        <select aria-label="Status" className={sel} value={f.status ?? ""} onChange={(e) => setF({ ...f, status: (e.target.value || undefined) as AniBrowse["status"] })}>
          <option value="">All statuses</option><option value="RELEASING">Releasing</option><option value="FINISHED">Finished</option><option value="NOT_YET_RELEASED">Upcoming</option>
        </select>
        <select aria-label="Year" className={sel} value={f.year ?? ""} onChange={(e) => setF({ ...f, year: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">All years</option>{Array.from({ length: 50 }, (_, k) => year + 1 - k).map((y) => <option key={y}>{y}</option>)}
        </select>
        {type === "ANIME" && (
          <select aria-label="Season" className={sel} value={f.season ?? ""} onChange={(e) => setF({ ...f, season: (e.target.value || undefined) as AniBrowse["season"] })}>
            <option value="">All seasons</option>{["WINTER", "SPRING", "SUMMER", "FALL"].map((s) => <option key={s} value={s}>{nice(s)}</option>)}
          </select>
        )}
        <select aria-label="Score" className={sel} value={f.minScore ?? ""} onChange={(e) => setF({ ...f, minScore: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Any score</option><option value="60">6+</option><option value="70">7+</option><option value="80">8+</option>
        </select>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 [&>a]:w-full">
        {items.map((x) => <AniPoster key={x.aniListId} item={x} />)}
        {(q.isLoading || q.isFetchingNextPage) && Array.from({ length: 6 }).map((_, k) => <PosterSkeleton key={k} />)}
      </div>
      {q.isError && <div className="mt-6"><EmptyState title={AL.unavailable[locale]} /></div>}
      {!q.isLoading && !q.isError && items.length === 0 && <div className="mt-6"><EmptyState title="—" /></div>}
      <div ref={sentinel} className="h-4" />
    </section>
  );
}

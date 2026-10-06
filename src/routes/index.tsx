import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { homeQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { nameOf } from "@/features/catalog/localize";
import { Hero } from "@/components/mb/Hero";
import { Row } from "@/components/mb/Row";
import { PosterCard, LandscapeCard } from "@/components/mb/Cards";
import { ContinueRow } from "@/components/mb/ContinueRow";
import { StarDivider, StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Movies, Series, Anime & Ramadan", "MOROBEST — a premium streaming home for world cinema, Arabic series, Ramadan, anime, manga and family entertainment."),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery()),
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  component: Home,
});

function Home() {
  const { maxAge } = useAuth();
  const { data } = useSuspenseQuery(homeQuery(maxAge));
  const { t, locale } = useI18n();
  const kidsMode = maxAge != null;

  return (
    <div className="pb-8">
      <Hero items={kidsMode ? data.kids.filter((k) => k.backdrop).slice(0, 3) : data.hero} />
      <div className="relative z-10 -mt-20">
        <ContinueRow />
        {kidsMode ? (
          <>
            <Row title={t.section.kids}>{data.kids.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
            <Row title={t.section.anime}>{data.anime.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
          </>
        ) : (
          <>
            <Row title={t.section.top10} eyebrow={t.section.trending}>
              {data.trending.map((x, i) => <PosterCard key={x.id} title={x} rank={i + 1} />)}
            </Row>
            <Row title={t.section.new} seeAll={{ to: "/new" }}>{data.newReleases.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
            {data.ramadan.length > 0 && (
              <Row title={`${t.section.ramadan} ${data.ramadanYear ?? ""}`} eyebrow="رمضان كريم" seeAll={{ to: "/ramadan" }}>
                {data.ramadan.map((x) => <LandscapeCard key={x.id} title={x} />)}
              </Row>
            )}
            <Row title={t.section.moroccan} eyebrow={t.nav.arabic} seeAll={{ to: "/arabic/$country", params: { country: "morocco" } }}>
              {data.moroccan.map((x) => <PosterCard key={x.id} title={x} />)}
            </Row>
            <Row title={t.section.movies} seeAll={{ to: "/movies" }}>{data.movies.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
            <Row title={t.section.series} seeAll={{ to: "/series" }}>{data.series.map((x) => <PosterCard key={x.id} title={x} />)}</Row>

            <section className="px-4 py-8 sm:px-8 lg:px-14">
              <StarDivider className="mb-8" />
              <p className="eyebrow mb-1">{t.section.arabicCinema}</p>
              <h2 className="font-display text-3xl font-semibold">{t.section.countries}</h2>
              <div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-2">
                {data.countries.map((c) => (
                  <Link
                    key={c.code}
                    to="/arabic/$country"
                    params={{ country: c.slug }}
                    className="group relative flex h-24 w-44 shrink-0 items-end overflow-hidden rounded-xl border border-border bg-emerald/40 p-4 transition hover:border-gold/60"
                  >
                    <span className="absolute inset-0 pattern-zellige opacity-10 transition group-hover:opacity-25" aria-hidden />
                    <span className="absolute end-3 top-3 font-display text-3xl text-gold/30 group-hover:text-gold/60">{c.code}</span>
                    <span className="relative font-display text-xl">{nameOf(c, locale)}</span>
                  </Link>
                ))}
              </div>
            </section>

            <Row title={t.section.anime} seeAll={{ to: "/anime" }}>{data.anime.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
            <Row title={t.section.kids} seeAll={{ to: "/kids" }}>{data.kids.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
            <Row title={t.section.manga} seeAll={{ to: "/manga" }}>{data.manga.map((x) => <PosterCard key={x.id} title={x} />)}</Row>
            <Row title={t.section.classics} seeAll={{ to: "/classics" }}>{data.classics.map((x) => <PosterCard key={x.id} title={x} />)}</Row>

            {data.collections.length > 0 && (
              <section className="px-4 py-6 sm:px-8 lg:px-14">
                <h2 className="mb-4 font-display text-3xl font-semibold">{t.section.collections}</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {data.collections.map((c) => (
                    <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }} className="group relative aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-border hover:ring-gold/60">
                      {c.cover_url && <img src={c.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
                      <div className="absolute inset-0 bg-card-fade" />
                      <span className="absolute bottom-4 start-4 font-display text-2xl">{nameOf({ ...c, slug: c.slug }, locale)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {data.gems.length > 0 && <Row title={t.section.gems}>{data.gems.map((x) => <PosterCard key={x.id} title={x} />)}</Row>}
          </>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { taxonomyQuery, titlesQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { nameOf } from "@/features/catalog/localize";
import { PageHeader, EmptyState, FullPageMessage } from "@/components/mb/States";
import { Row } from "@/components/mb/Row";
import { PosterCard, LandscapeCard } from "@/components/mb/Cards";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/arabic/$country")({
  loader: async ({ context, params }) => {
    const tax = await context.queryClient.ensureQueryData(taxonomyQuery());
    const country = tax.countries.find((c) => c.slug === params.country);
    if (!country) throw notFound();
    return { country };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(`${loaderData.country.name_en} — Movies & Series`, `Watch ${loaderData.country.name_en} movies, series, Ramadan dramas and classics on MOROBEST.`)
      : { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <FullPageMessage code="404" title="Country not found" />,
  component: CountryPage,
});

function CountryPage() {
  const { country } = Route.useLoaderData();
  const { t, locale } = useI18n();
  const { maxAge } = useAuth();
  const base = { country: country.slug, maxAge, limit: 30 };
  const featured = useQuery(titlesQuery({ ...base }));
  const movies = useQuery(titlesQuery({ ...base, kind: "movie", sort: "newest" }));
  const series = useQuery(titlesQuery({ ...base, kind: "series", sort: "newest" }));
  const comedy = useQuery(titlesQuery({ ...base, genre: "comedy" }));
  const drama = useQuery(titlesQuery({ ...base, genre: "drama" }));
  const classics = useQuery(titlesQuery({ ...base, classic: true }));

  const rows = [
    [t.section.newMovies, movies.data],
    [t.section.newSeries, series.data],
    ["Drama", drama.data],
    ["Comedy", comedy.data],
    [t.section.classics, classics.data],
  ] as const;

  return (
    <div>
      <PageHeader eyebrow={t.section.countries} title={nameOf(country, locale)} subtitle={locale === "ar" ? country.name_en : country.name_ar} />
      {featured.data && featured.data.length === 0 && <div className="px-4 py-10"><EmptyState title={t.empty.generic} /></div>}
      {featured.data && featured.data.length > 0 && (
        <Row title={t.section.mostWatched}>{featured.data.map((x) => <LandscapeCard key={x.id} title={x} />)}</Row>
      )}
      {rows.map(([label, list]) =>
        list && list.length > 0 ? <Row key={label} title={label}>{list.map((x) => <PosterCard key={x.id} title={x} />)}</Row> : null,
      )}
    </div>
  );
}

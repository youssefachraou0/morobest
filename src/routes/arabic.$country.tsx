import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { taxonomyQuery } from "@/features/catalog/queries";
import { tmdbCountryQuery } from "@/features/tmdb/tmdb.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { nameOf } from "@/features/catalog/localize";
import { FullPageMessage } from "@/components/mb/States";
import { Row } from "@/components/mb/Row";
import { Badge } from "@/components/mb/Cards";
import { StarLoader } from "@/components/mb/Brand";
import { TmdbAttribution, TmdbGrid, TmdbHero, TmdbPersonTile, TmdbRows } from "@/components/mb/Tmdb";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/arabic/$country")({
  loader: async ({ context, params }) => {
    const tax = await context.queryClient.ensureQueryData(taxonomyQuery());
    const country = tax.countries.find((c) => c.slug === params.country);
    if (!country) throw notFound();
    await context.queryClient.ensureQueryData(tmdbCountryQuery(country.code, context.locale));
    return { country };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(`${loaderData.country.name_en} — Movies & Series`, `${loaderData.country.name_en} movies, series, classics, actors and new releases on MOROBEST.`)
      : { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] },
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  notFoundComponent: () => <FullPageMessage code="404" title="Country not found" />,
  errorComponent: () => <FullPageMessage title="The catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: CountryPage,
});

const C = {
  actors: { en: "Actors", fr: "Acteurs", ar: "الممثلون" },
  genres: { en: "Genres", fr: "Genres", ar: "الأنواع" },
};

function CountryPage() {
  const { country } = Route.useLoaderData();
  const { locale } = useI18n();
  const { data } = useSuspenseQuery(tmdbCountryQuery(country.code, locale));
  return (
    <div className="pb-10">
      <TmdbHero items={data.hero} />
      <div className="relative -mt-20 px-4 sm:px-8 lg:px-14">
        <p className="eyebrow">{locale === "ar" ? country.name_en : country.name_ar}</p>
        <h1 className="font-display text-5xl font-semibold">{nameOf(country, locale)}</h1>
        {data.genres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label={C.genres[locale]}>
            {data.genres.map((g) => <Badge key={g.id} tone="gold">{g.name}</Badge>)}
          </div>
        )}
      </div>
      <TmdbRows rows={data.rows} />
      {data.people.length > 0 && <Row title={C.actors[locale]}>{data.people.map((p) => <TmdbPersonTile key={p.id} p={p} />)}</Row>}
      <TmdbGrid type="movie" country={country.code} />
      <TmdbGrid type="tv" country={country.code} />
      <TmdbAttribution />
    </div>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { tmdbPersonQuery } from "@/features/tmdb/tmdb.functions";
import { idFromSlug, tmdbImg } from "@/features/tmdb/image";
import { useI18n } from "@/i18n/I18nProvider";
import { Row } from "@/components/mb/Row";
import { TmdbAttribution, TmdbPoster } from "@/components/mb/Tmdb";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/person/$slug")({
  loader: async ({ context, params }) => {
    const id = idFromSlug(params.slug);
    if (!Number.isFinite(id) || id <= 0) throw notFound();
    const p = await context.queryClient.ensureQueryData(tmdbPersonQuery(id, context.locale));
    if (!p) throw notFound();
    return { id, name: p.name, bio: p.biography, image: tmdbImg(p.photo, "h632") };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(loaderData.name, (loaderData.bio ?? `Movies and series featuring ${loaderData.name} on MOROBEST.`).slice(0, 160), loaderData.image)
      : { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] },
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  notFoundComponent: () => <FullPageMessage code="404" title="This person could not be found." />,
  errorComponent: () => <FullPageMessage title="This page is temporarily unavailable." body="Please try again in a moment." />,
  component: PersonPage,
});

const P = {
  known: { en: "Known for", fr: "Connu pour", ar: "اشتهر بـ" },
  movies: { en: "Movie credits", fr: "Filmographie", ar: "الأفلام" },
  tv: { en: "TV credits", fr: "Séries", ar: "المسلسلات" },
};

function PersonPage() {
  const { id } = Route.useLoaderData();
  const { locale } = useI18n();
  const { data: p } = useSuspenseQuery(tmdbPersonQuery(id, locale));
  if (!p) return null;
  return (
    <div className="pb-10">
      <section className="flex flex-col gap-8 px-4 pb-6 pt-28 sm:px-8 md:flex-row lg:px-14">
        <div className="w-48 shrink-0 overflow-hidden rounded-xl bg-surface-2 shadow-poster ring-1 ring-gold/30 sm:w-60">
          {p.photo && <img src={tmdbImg(p.photo, "h632")!} alt={p.name} className="w-full object-cover" />}
        </div>
        <div className="max-w-3xl">
          <p className="eyebrow">{p.department}</p>
          <h1 className="font-display text-5xl font-semibold">{p.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{[p.birthday, p.placeOfBirth].filter(Boolean).join(" · ")}</p>
          {p.biography && <p className="mt-5 whitespace-pre-line leading-relaxed text-foreground/85">{p.biography}</p>}
        </div>
      </section>
      {p.knownFor.length > 0 && <Row title={P.known[locale]}>{p.knownFor.map((x) => <TmdbPoster key={x.type + x.tmdbId} item={x} />)}</Row>}
      {p.movies.length > 0 && <Row title={`${P.movies[locale]} · ${p.movies.length}`}>{p.movies.slice(0, 40).map((x) => <TmdbPoster key={x.tmdbId} item={x} />)}</Row>}
      {p.tv.length > 0 && <Row title={`${P.tv[locale]} · ${p.tv.length}`}>{p.tv.slice(0, 40).map((x) => <TmdbPoster key={x.tmdbId} item={x} />)}</Row>}
      <TmdbAttribution />
    </div>
  );
}

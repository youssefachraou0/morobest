import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { taxonomyQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { nameOf } from "@/features/catalog/localize";
import { PageHeader } from "@/components/mb/States";
import { StarDivider } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/explore")({
  head: () => seo("Explore", "Explore every MOROBEST world — movies, series, Arabic, Ramadan, anime, manga, kids, classics and genres."),
  loader: ({ context }) => context.queryClient.ensureQueryData(taxonomyQuery()),
  component: Explore,
});

function Explore() {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(taxonomyQuery());
  const worlds = [
    ["/movies", t.nav.movies, "/images/posters/p4.jpg"], ["/series", t.nav.series, "/images/posters/p5.jpg"],
    ["/arabic", t.nav.arabic, "/images/posters/p1.jpg"], ["/ramadan", t.nav.ramadan, "/images/posters/p6.jpg"],
    ["/anime", t.nav.anime, "/images/posters/p8.jpg"], ["/manga", t.nav.manga, "/images/posters/p9.jpg"],
    ["/kids", t.nav.kids, "/images/posters/p10.jpg"], ["/classics", t.nav.classics, "/images/posters/p7.jpg"],
  ] as const;
  return (
    <div>
      <PageHeader eyebrow={t.nav.explore} title={t.section.worlds} />
      <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-4 sm:px-8 lg:px-14">
        {worlds.map(([to, label, img]) => (
          <Link key={to} to={to} className="group relative aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-border hover:ring-gold/60">
            <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-card-fade" />
            <span className="absolute bottom-4 start-4 font-display text-3xl">{label}</span>
          </Link>
        ))}
      </div>
      <StarDivider className="mx-4 my-10 sm:mx-8 lg:mx-14" />
      <section className="px-4 sm:px-8 lg:px-14">
        <h2 className="mb-4 font-display text-3xl">{t.section.genres}</h2>
        <div className="flex flex-wrap gap-2">
          {data.genres.map((g) => (
            <Link key={g.slug} to="/movies" search={{ genre: g.slug }} className="rounded-full border border-border px-4 py-2 text-sm hover:border-gold hover:text-gold">{nameOf(g, locale)}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}

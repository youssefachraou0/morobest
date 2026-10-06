import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { taxonomyQuery } from "@/features/catalog/queries";
import { tmdbWorldQuery } from "@/features/tmdb/tmdb.functions";
import { tmdbImg } from "@/features/tmdb/image";
import { useI18n } from "@/i18n/I18nProvider";
import { nameOf } from "@/features/catalog/localize";
import { PageHeader, FullPageMessage } from "@/components/mb/States";
import { StarDivider } from "@/components/mb/Brand";
import { TmdbGrid } from "@/components/mb/Tmdb";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  head: () => seo("Explore", "Explore MOROBEST — real movies, series, anime, manga, Arabic cinema by country, kids, classics and Ramadan, filtered by genre and year."),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(taxonomyQuery()),
    context.queryClient.ensureQueryData(tmdbWorldQuery("home", context.locale)),
  ]),
  errorComponent: () => <FullPageMessage title="Explore is temporarily unavailable." body="Please try again in a moment." />,
  component: Explore,
});

function Explore() {
  const { t, locale } = useI18n();
  const { data: tax } = useSuspenseQuery(taxonomyQuery());
  const { data: world } = useSuspenseQuery(tmdbWorldQuery("home", locale));
  const [type, setType] = useState<"movie" | "tv">("movie");
  const pool = [...world.hero, ...world.rows.flatMap((r) => r.items)].filter((x) => x.backdrop);
  const img = (i: number) => tmdbImg(pool[i % Math.max(pool.length, 1)]?.backdrop ?? null, "w780");
  const worlds = [
    ["/movies", t.nav.movies], ["/series", t.nav.series], ["/arabic", t.nav.arabic], ["/ramadan", t.nav.ramadan],
    ["/anime", t.nav.anime], ["/manga", t.nav.manga], ["/kids", t.nav.kids], ["/classics", t.nav.classics],
  ] as const;
  const arab = tax.countries.filter((c) => c.is_arab);
  return (
    <div>
      <PageHeader eyebrow={t.nav.explore} title={t.section.worlds} />
      <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-4 sm:px-8 lg:px-14">
        {worlds.map(([to, label], i) => (
          <Link key={to} to={to} className="group relative aspect-video overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border hover:ring-gold/60">
            {img(i * 3) && <img src={img(i * 3)!} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-card-fade" />
            <span className="absolute bottom-3 start-4 font-display text-2xl sm:text-3xl">{label}</span>
          </Link>
        ))}
      </div>
      <StarDivider className="mx-4 my-10 sm:mx-8 lg:mx-14" />
      <section className="px-4 sm:px-8 lg:px-14">
        <h2 className="mb-4 font-display text-3xl">{t.nav.arabic}</h2>
        <div className="flex flex-wrap gap-2">
          {arab.map((c) => (
            <Link key={c.code} to="/arabic/$country" params={{ country: c.slug }} className="rounded-full border border-border px-4 py-2 text-sm hover:border-gold hover:text-gold">{nameOf(c, locale)}</Link>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-8 lg:px-14">
          <h2 className="font-display text-3xl">{t.section.genres}</h2>
          {(["movie", "tv"] as const).map((k) => (
            <button key={k} onClick={() => setType(k)} className={cn("rounded-full border px-4 py-1.5 text-sm", type === k ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground")}>
              {k === "movie" ? t.nav.movies : t.nav.series}
            </button>
          ))}
        </div>
        <TmdbGrid key={type} type={type} />
      </section>
    </div>
  );
}

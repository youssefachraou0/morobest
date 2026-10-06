import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { taxonomyQuery } from "@/features/catalog/queries";
import { tmdbWorldQuery } from "@/features/tmdb/tmdb.functions";
import { TmdbRows, TmdbAttribution } from "@/components/mb/Tmdb";
import { useI18n } from "@/i18n/I18nProvider";
import { nameOf } from "@/features/catalog/localize";
import { PageHeader } from "@/components/mb/States";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/arabic/")({
  head: () => seo("Arabic Cinema & Series", "Arabic movies and series from Morocco, Egypt, Algeria, Tunisia, the Gulf, the Levant and every Arab country."),
  loader: ({ context }) => context.queryClient.ensureQueryData(taxonomyQuery()),
  component: ArabicHub,
});

const REGIONS = [["maghreb", "Maghreb · المغرب العربي"], ["egypt", "Egypt · مصر"], ["gulf", "Gulf · الخليج"], ["levant", "Levant · الشام"], ["africa", "Africa · أفريقيا"]] as const;

function ArabicHub() {
  const { t, locale } = useI18n();
  const { data: tax } = useSuspenseQuery(taxonomyQuery());
  const world = useQuery(tmdbWorldQuery("arabic", locale));
  const arab = tax.countries.filter((c) => c.is_arab);

  return (
    <div>
      <PageHeader eyebrow={t.nav.arabic} title={t.section.arabicCinema} subtitle="السينما والدراما العربية — من المحيط إلى الخليج" />
      {world.data && <TmdbRows rows={world.data.rows} />}
      <section className="space-y-8 px-4 py-8 sm:px-8 lg:px-14">
        {REGIONS.map(([r, label]) => {
          const list = arab.filter((c) => c.region === r);
          if (!list.length) return null;
          return (
            <div key={r}>
              <p className="eyebrow mb-3">{label}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {list.map((c) => (
                  <Link key={c.code} to="/arabic/$country" params={{ country: c.slug }} className="group relative flex h-24 items-end overflow-hidden rounded-xl border border-border bg-surface p-4 transition hover:border-gold/60">
                    <span className="absolute inset-0 pattern-zellige opacity-[0.07] transition group-hover:opacity-20" aria-hidden />
                    <span className="absolute end-3 top-2 font-display text-3xl text-gold/25 group-hover:text-gold/60">{c.code}</span>
                    <span className="relative font-display text-lg">{nameOf(c, locale)}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      <TmdbAttribution />
    </div>
  );
}

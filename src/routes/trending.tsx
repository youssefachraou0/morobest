import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmdbWorldView } from "@/components/mb/Tmdb";
import { tmdbWorldQuery } from "@/features/tmdb/tmdb.functions";
import { behavioralTrendingQuery } from "@/features/analytics/analytics.functions";
import { useCanonical } from "@/features/editorial/canonical";
import { useI18n } from "@/i18n/I18nProvider";
import { track } from "@/features/analytics/track";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trending")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tmdbWorldQuery("trending", context.locale)),
  head: () => seo("Trending now", "What MOROBEST viewers are watching right now, plus trending movies and series worldwide."),
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  errorComponent: () => <FullPageMessage title="The catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: () => (<><OnMorobest /><TmdbWorldView kind="trending" /></>),
});

/** Ranked by real MOROBEST viewing behavior (recency-weighted, one count per viewer per day). Hidden until there is enough signal. */
function OnMorobest() {
  const { locale } = useI18n();
  const canonical = useCanonical();
  const q = useQuery(behavioralTrendingQuery(locale));
  if (!q.data || q.data.length < 3) return null;
  return (
    <section className="px-4 pt-24 sm:px-8 lg:px-14">
      <h2 className="mb-4 font-display text-2xl">Trending on MOROBEST</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {q.data.map((t, i) => (
          <Link key={t.key} {...canonical(t.ref)} onClick={() => track("click", { key: t.key, ctx: "trending_mb" })} className="group w-36 shrink-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface">
              {t.poster && <img src={t.poster} alt={t.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
              <span className="absolute start-2 top-2 rounded bg-background/80 px-1.5 text-sm font-display text-gold">{i + 1}</span>
            </div>
            <p className="mt-1.5 truncate text-sm">{t.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

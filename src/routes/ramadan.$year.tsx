import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { ramadanQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { tr } from "@/features/catalog/localize";
import { Row } from "@/components/mb/Row";
import { Badge, LandscapeCard, PosterCard } from "@/components/mb/Cards";
import { EmptyState } from "@/components/mb/States";
import { Star8, StarDivider } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ramadan/$year")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(ramadanQuery(Number(params.year) || undefined)),
  head: ({ params }) => seo(`Ramadan ${params.year}`, `The Ramadan ${params.year} hub — Moroccan, Egyptian, Algerian, Tunisian, Gulf and Levantine series with a daily schedule.`),
  component: RamadanPage,
});

const GROUPS: [string, string[], string][] = [
  ["Moroccan Ramadan", ["MA"], "رمضان المغربي"],
  ["Egyptian Ramadan", ["EG"], "رمضان المصري"],
  ["Algerian & Tunisian", ["DZ", "TN", "LY"], "الجزائر وتونس"],
  ["Gulf Ramadan", ["SA", "AE", "KW", "QA", "BH", "OM"], "رمضان الخليج"],
  ["Syrian & Lebanese", ["SY", "LB", "JO", "PS", "IQ"], "دراما الشام"],
];

function RamadanPage() {
  const { year } = Route.useParams();
  const { maxAge } = useAuth();
  const { data } = useSuspenseQuery(ramadanQuery(Number(year) || undefined, maxAge));
  const { t, locale } = useI18n();
  const entries = data.entries;
  const schedule = [...entries].filter((e) => e.airTime).sort((a, b) => (a.airTime! < b.airTime! ? -1 : 1));
  const featured = entries[0]?.card;

  return (
    <div>
      <section className="relative overflow-hidden px-4 pb-10 pt-28 sm:px-8 lg:px-14">
        {featured?.backdrop && <img src={featured.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="absolute inset-0 bg-emerald-glow" />
        <div className="absolute inset-0 pattern-zellige opacity-[0.06]" aria-hidden />
        <div className="relative animate-fade-up">
          <p className="eyebrow flex items-center gap-2"><Star8 className="h-3 w-3" /> رمضان كريم · Ramadan Kareem</p>
          <h1 className="mt-3 font-display text-6xl font-semibold sm:text-8xl">
            {t.nav.ramadan} <span className="text-gold-gradient">{data.season?.year ?? year}</span>
          </h1>
          {data.season && <p className="mt-2 text-muted-foreground">{data.season.starts_on} → {data.season.ends_on}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {data.seasons.map((s) => (
              <Link
                key={s.id}
                to="/ramadan/$year"
                params={{ year: String(s.year) }}
                className={cn("rounded-full border px-4 py-1.5 text-sm transition", String(s.year) === year ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {s.year}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <div className="px-4 py-10"><EmptyState title={t.section.upcoming} body={t.empty.generic} /></div>
      ) : (
        <>
          {schedule.length > 0 && (
            <section className="px-4 py-6 sm:px-8 lg:px-14">
              <h2 className="mb-4 font-display text-3xl font-semibold">{t.section.schedule}</h2>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {schedule.map((e) => (
                  <li key={e.card.id}>
                    <Link to="/title/$slug" params={{ slug: e.card.slug }} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-gold/50">
                      <span className="flex h-14 w-16 flex-col items-center justify-center rounded-lg bg-emerald text-gold">
                        <Clock className="h-3.5 w-3.5" /><span className="font-display text-lg leading-none">{e.airTime}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-medium">{tr(e.card, locale).title}</span>
                        <Badge tone={e.status === "airing" ? "red" : e.status === "upcoming" ? "gold" : "default"}>
                          {e.status === "airing" ? t.label.airing : e.status === "upcoming" ? t.label.upcoming : t.label.completed}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <Row title={t.section.mostWatched}>
            {[...entries].sort((a, b) => b.card.popularity - a.card.popularity).map((e) => <LandscapeCard key={e.card.id} title={e.card} />)}
          </Row>
          <StarDivider className="mx-4 my-4 sm:mx-8 lg:mx-14" />
          {GROUPS.map(([label, codes, arLabel]) => {
            const list = entries.filter((e) => e.countries.some((c) => codes.includes(c)));
            return list.length ? (
              <Row key={label} title={locale === "ar" ? arLabel : label}>{list.map((e) => <PosterCard key={e.card.id} title={e.card} />)}</Row>
            ) : null;
          })}
        </>
      )}
    </div>
  );
}

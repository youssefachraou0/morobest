import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import type { RamadanEntry, RamadanHub as Hub } from "@/features/editorial/ramadan.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { Row } from "./Row";
import { Badge } from "./Cards";
import { EmptyState } from "./States";
import { Star8, StarDivider } from "./Brand";
import { cn } from "@/lib/utils";

export const RAMADAN_GROUPS: { slug: string; codes: string[]; en: string; fr: string; ar: string }[] = [
  { slug: "morocco", codes: ["MA"], en: "Morocco", fr: "Maroc", ar: "المغرب" },
  { slug: "egypt", codes: ["EG"], en: "Egypt", fr: "Égypte", ar: "مصر" },
  { slug: "algeria", codes: ["DZ"], en: "Algeria", fr: "Algérie", ar: "الجزائر" },
  { slug: "tunisia", codes: ["TN"], en: "Tunisia", fr: "Tunisie", ar: "تونس" },
  { slug: "gulf", codes: ["SA", "AE", "KW", "QA", "BH", "OM"], en: "Gulf", fr: "Golfe", ar: "الخليج" },
  { slug: "levant", codes: ["SY", "LB", "JO", "PS", "IQ"], en: "Levant", fr: "Levant", ar: "الشام" },
];
const L = {
  featured: { en: "Featured Ramadan titles", fr: "À la une du Ramadan", ar: "مختارات رمضان" },
  today: { en: "Today's episodes", fr: "Épisodes du jour", ar: "حلقات اليوم" },
  most: { en: "Most watched", fr: "Les plus regardés", ar: "الأكثر مشاهدة" },
  recent: { en: "Recently added", fr: "Ajoutés récemment", ar: "أضيفت مؤخرًا" },
  completed: { en: "Completed series", fr: "Séries terminées", ar: "مسلسلات مكتملة" },
  all: { en: "All countries", fr: "Tous les pays", ar: "كل الدول" },
  none: { en: "No titles have been assigned to this Ramadan yet.", fr: "Aucun titre n'a encore été attribué à ce Ramadan.", ar: "لم تتم إضافة أعمال لهذا الموسم بعد." },
  status: { airing: { en: "Airing", fr: "En cours", ar: "يعرض الآن" }, upcoming: { en: "Upcoming", fr: "À venir", ar: "قريبًا" }, completed: { en: "Completed", fr: "Terminé", ar: "مكتمل" } },
} as const;

function Poster({ e }: { e: RamadanEntry }) {
  const { locale } = useI18n();
  return (
    <Link to={e.to} params={{ slug: e.slug }} className="group block w-[136px] shrink-0 sm:w-[168px]">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-foreground/10 transition group-hover:ring-gold/60">
        {e.poster ? <img src={e.poster} alt={e.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-3 text-center font-display">{e.title}</div>}
        <div className="absolute start-2 top-2"><Badge tone={e.status === "airing" ? "red" : e.status === "upcoming" ? "gold" : "default"}>{L.status[e.status][locale]}</Badge></div>
      </div>
      <p className="mt-2 line-clamp-1 text-sm">{e.title}</p>
      <p className="text-xs text-muted-foreground">{[e.year, e.airTime].filter(Boolean).join(" · ")}</p>
    </Link>
  );
}

export function RamadanHubView({ hub, year, country }: { hub: Hub; year: string; country?: string }) {
  const { t, locale } = useI18n();
  const group = country ? RAMADAN_GROUPS.find((g) => g.slug === country) ?? (() => {
    const c = hub.countries.find((x) => x.slug === country);
    return c ? { slug: c.slug, codes: [c.code], en: c.name, fr: c.name, ar: c.name } : null;
  })() : null;
  const entries = group ? hub.entries.filter((e) => e.country && group.codes.includes(e.country)) : hub.entries;
  const featured = entries.filter((e) => e.featured);
  const hero = hub.season?.hero ?? featured[0]?.backdrop ?? entries[0]?.backdrop ?? null;
  const today = entries.filter((e) => e.status === "airing" && e.airTime).sort((a, b) => (a.airTime! < b.airTime! ? -1 : 1));
  const chip = (to: string | undefined, label: string, active: boolean) => to
    ? <Link key={to} to="/ramadan/$year/$country" params={{ year, country: to }} className={cn("rounded-full border px-4 py-1.5 text-sm transition", active ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground hover:text-foreground")}>{label}</Link>
    : <Link key="all" to="/ramadan/$year" params={{ year }} className={cn("rounded-full border px-4 py-1.5 text-sm transition", active ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground hover:text-foreground")}>{label}</Link>;

  return (
    <div>
      <section className="relative overflow-hidden px-4 pb-10 pt-28 sm:px-8 lg:px-14">
        {hero && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="absolute inset-0 bg-emerald-glow" />
        <div className="absolute inset-0 pattern-zellige opacity-[0.06]" aria-hidden />
        <div className="relative animate-fade-up">
          <p className="eyebrow flex items-center gap-2"><Star8 className="h-3 w-3" /> رمضان كريم · Ramadan Kareem</p>
          <h1 className="mt-3 font-display text-6xl font-semibold sm:text-8xl">
            {hub.season?.name ?? t.nav.ramadan} <span className="text-gold-gradient">{hub.season?.year ?? year}</span>
          </h1>
          {group && <p className="mt-2 font-display text-3xl text-gold">{group[locale]}</p>}
          {hub.season && <p className="mt-2 text-muted-foreground">{hub.season.startsOn} → {hub.season.endsOn}</p>}
          {hub.season?.description && <p className="mt-3 max-w-2xl text-foreground/80">{hub.season.description}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {hub.seasons.map((s) => (
              <Link key={s.year} to="/ramadan/$year" params={{ year: String(s.year) }} className={cn("rounded-full border px-4 py-1.5 text-sm", String(s.year) === year ? "border-gold text-gold" : "border-border text-muted-foreground")}>{s.year}</Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chip(undefined, L.all[locale], !group)}
            {RAMADAN_GROUPS.map((g) => chip(g.slug, g[locale], group?.slug === g.slug))}
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <div className="px-4 py-10"><EmptyState title={t.section.upcoming} body={L.none[locale]} /></div>
      ) : (
        <>
          {featured.length > 0 && <Row title={L.featured[locale]}>{featured.map((e) => <Poster key={e.key} e={e} />)}</Row>}
          {today.length > 0 && (
            <section className="px-4 py-6 sm:px-8 lg:px-14">
              <h2 className="mb-4 font-display text-3xl font-semibold">{L.today[locale]}</h2>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {today.map((e) => (
                  <li key={e.key}>
                    <Link to={e.to} params={{ slug: e.slug }} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-gold/50">
                      <span className="flex h-14 w-16 flex-col items-center justify-center rounded-lg bg-emerald text-gold"><Clock className="h-3.5 w-3.5" /><span className="font-display text-lg leading-none">{e.airTime}</span></span>
                      <span className="min-w-0"><span className="line-clamp-1 font-medium">{e.title}</span>{e.schedule && <span className="line-clamp-1 text-xs text-muted-foreground">{e.schedule}</span>}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {!group && RAMADAN_GROUPS.map((g) => {
            const list = entries.filter((e) => e.country && g.codes.includes(e.country));
            return list.length ? <Row key={g.slug} title={g[locale]}>{list.map((e) => <Poster key={e.key} e={e} />)}</Row> : null;
          })}
          <StarDivider className="mx-4 my-4 sm:mx-8 lg:mx-14" />
          <Row title={L.most[locale]}>{[...entries].sort((a, b) => b.popularity - a.popularity).map((e) => <Poster key={e.key} e={e} />)}</Row>
          <Row title={L.recent[locale]}>{[...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 20).map((e) => <Poster key={e.key} e={e} />)}</Row>
          {entries.some((e) => e.status === "completed") && <Row title={L.completed[locale]}>{entries.filter((e) => e.status === "completed").map((e) => <Poster key={e.key} e={e} />)}</Row>}
        </>
      )}
    </div>
  );
}

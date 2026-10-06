import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { collectionsQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { nameOf } from "@/features/catalog/localize";
import { PageHeader } from "@/components/mb/States";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/collections/")({
  head: () => seo("Collections", "Curated MOROBEST collections — themed journeys through cinema, series and classics."),
  loader: ({ context }) => context.queryClient.ensureQueryData(collectionsQuery()),
  component: Collections,
});

function Collections() {
  const { data } = useSuspenseQuery(collectionsQuery());
  const { t, locale } = useI18n();
  return (
    <div>
      <PageHeader eyebrow={t.nav.collections} title={t.section.collections} />
      <div className="grid gap-5 px-4 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-14">
        {data.map((c) => (
          <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }} className="group relative aspect-video overflow-hidden rounded-xl ring-1 ring-border hover:ring-gold/60">
            {c.cover_url && <img src={c.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-card-fade" />
            <div className="absolute bottom-4 start-4 end-4">
              <p className="font-display text-3xl">{nameOf(c, locale)}</p>
              {c.description_en && <p className="text-sm text-muted-foreground">{c.description_en}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

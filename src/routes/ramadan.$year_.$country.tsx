import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ramadanHubQuery } from "@/features/editorial/ramadan.functions";
import { RAMADAN_GROUPS, RamadanHubView } from "@/components/mb/RamadanHub";
import { FullPageMessage } from "@/components/mb/States";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/ramadan/$year_/$country")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(ramadanHubQuery(Number(params.year) || undefined, context.locale)),
  head: ({ params }) => {
    const name = RAMADAN_GROUPS.find((g) => g.slug === params.country)?.en ?? params.country.replace(/-/g, " ");
    return seo(`Ramadan ${params.year} · ${name}`, `${name} Ramadan ${params.year} series on MOROBEST — the editors' selection with daily episodes.`);
  },
  errorComponent: () => <FullPageMessage title="Ramadan is temporarily unavailable." body="Please try again in a moment." />,
  notFoundComponent: () => <FullPageMessage code="404" title="Season not found." />,
  component: Page,
});

function Page() {
  const { year, country } = Route.useParams();
  const { locale } = useI18n();
  const { data } = useSuspenseQuery(ramadanHubQuery(Number(year) || undefined, locale));
  return <RamadanHubView hub={data} year={year} country={country} />;
}

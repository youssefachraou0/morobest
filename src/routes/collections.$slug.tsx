import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { collectionQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { nameOf } from "@/features/catalog/localize";
import { PageHeader, FullPageMessage } from "@/components/mb/States";
import { PosterCard } from "@/components/mb/Cards";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/collections/$slug")({
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(collectionQuery(params.slug));
    if (!c) throw notFound();
    return { name: c.name_en, description: c.description_en };
  },
  head: ({ loaderData }) =>
    loaderData ? seo(loaderData.name, loaderData.description ?? `The ${loaderData.name} collection on MOROBEST.`) : { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <FullPageMessage code="404" title="Collection not found" />,
  component: CollectionPage,
});

function CollectionPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(collectionQuery(slug));
  const { t, locale } = useI18n();
  if (!data) return null;
  return (
    <div>
      <PageHeader eyebrow={t.nav.collections} title={nameOf(data, locale)} subtitle={data.description_en ?? undefined} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 py-8 sm:grid-cols-4 sm:px-8 lg:grid-cols-6 lg:px-14 [&>a]:w-full">
        {data.titles.map((x) => <PosterCard key={x.id} title={x} />)}
      </div>
    </div>
  );
}

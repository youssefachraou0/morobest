import { createFileRoute, notFound } from "@tanstack/react-router";
import { aniDetailQuery, idFromSlug } from "@/features/anilist/anilist.functions";
import { AniDetailPage } from "@/components/mb/AniDetailPage";
import { FullPageMessage } from "@/components/mb/States";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/anime/$slug")({
  loader: async ({ context, params }) => {
    const id = idFromSlug(params.slug);
    if (!Number.isFinite(id)) throw notFound();
    const d = await context.queryClient.ensureQueryData(aniDetailQuery("ANIME", id));
    if (!d) throw notFound();
    return { id, title: d.title, synopsis: d.synopsis, image: d.backdrop ?? d.poster, slug: d.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] };
    const s = seo(`${loaderData.title} (Anime)`, (loaderData.synopsis ?? `${loaderData.title} on MOROBEST.`).slice(0, 160), loaderData.image);
    return { ...s, links: [{ rel: "canonical", href: `https://morobest.lovable.app/anime/${loaderData.slug}` }] };
  },
  notFoundComponent: () => <FullPageMessage code="404" title="This title could not be found." />,
  errorComponent: () => <FullPageMessage title="This page is temporarily unavailable." body="Please try again in a moment." />,
  component: Page,
});

function Page() {
  const { id } = Route.useLoaderData();
  return <AniDetailPage type="ANIME" id={id} />;
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { tmdbDetailQuery } from "@/features/tmdb/tmdb.functions";
import { idFromSlug, tmdbImg } from "@/features/tmdb/image";
import { TmdbDetailPage } from "@/components/mb/TmdbDetailPage";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/tv/$slug")({
  loader: async ({ context, params }) => {
    const id = idFromSlug(params.slug);
    if (!Number.isFinite(id) || id <= 0) throw notFound();
    const d = await context.queryClient.ensureQueryData(tmdbDetailQuery("tv", id, context.locale));
    if (!d) throw notFound();
    return { id, title: d.title, overview: d.overview, image: tmdbImg(d.backdrop ?? d.poster, "w1280"), slug: d.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] };
    const s = seo(`${loaderData.title} (Series)`, (loaderData.overview ?? `${loaderData.title} on MOROBEST.`).slice(0, 160), loaderData.image);
    return { ...s, links: [{ rel: "canonical", href: `https://morobest.lovable.app/tv/${loaderData.slug}` }] };
  },
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  notFoundComponent: () => <FullPageMessage code="404" title="This series could not be found." />,
  errorComponent: () => <FullPageMessage title="This page is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <TmdbDetailPage type="tv" id={Route.useLoaderData().id} />,
});

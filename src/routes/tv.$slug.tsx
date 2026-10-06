import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { tmdbDetailQuery } from "@/features/tmdb/tmdb.functions";
import { tmdbImg } from "@/features/tmdb/image";
import { applyOverride, overlayQuery, resolveContentSlug, seoHead } from "@/features/editorial/editorial.functions";
import { TmdbDetailPage } from "@/components/mb/TmdbDetailPage";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";

export const Route = createFileRoute("/tv/$slug")({
  loader: async ({ context, params }) => {
    const r = await resolveContentSlug({ data: { ct: "series", slug: params.slug } });
    if (r.redirectSlug) throw redirect({ to: "/tv/$slug", params: { slug: r.redirectSlug }, statusCode: 301 });
    if (!r.pid) throw notFound();
    const [raw, ov] = await Promise.all([
      context.queryClient.ensureQueryData(tmdbDetailQuery("tv", r.pid, context.locale)),
      context.queryClient.ensureQueryData(overlayQuery("series", r.pid, context.locale)),
    ]);
    if (!raw) throw notFound();
    const d = applyOverride(raw, ov.override);
    return { id: r.pid, locale: context.locale, title: d.title, overview: d.overview, image: tmdbImg(d.backdrop ?? d.poster, "w1280"), slug: ov.seo?.slug ?? d.slug, seo: ov.seo };
  },
  head: ({ loaderData: l }) => {
    if (!l) return { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] };
    return seoHead({ locale: l.locale, title: `${l.title} (Series)`, description: (l.overview ?? `${l.title} on MOROBEST.`).slice(0, 160), image: l.image, path: `/tv/${l.slug}`, seo: l.seo });
  },
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  notFoundComponent: () => <FullPageMessage code="404" title="This series could not be found." />,
  errorComponent: () => <FullPageMessage title="This page is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <TmdbDetailPage type="tv" id={Route.useLoaderData().id} />,
});

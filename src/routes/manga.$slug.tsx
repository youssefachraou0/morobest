import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { aniDetailQuery } from "@/features/anilist/anilist.functions";
import { applyOverride, overlayQuery, resolveContentSlug, seoHead } from "@/features/editorial/editorial.functions";
import { AniDetailPage } from "@/components/mb/AniDetailPage";
import { FullPageMessage } from "@/components/mb/States";

export const Route = createFileRoute("/manga/$slug")({
  loader: async ({ context, params }) => {
    const r = await resolveContentSlug({ data: { ct: "manga", slug: params.slug } });
    if (r.redirectSlug) throw redirect({ to: "/manga/$slug", params: { slug: r.redirectSlug }, statusCode: 301 });
    if (!r.pid) throw notFound();
    const [raw, ov] = await Promise.all([
      context.queryClient.ensureQueryData(aniDetailQuery("MANGA", r.pid)),
      context.queryClient.ensureQueryData(overlayQuery("manga", r.pid, context.locale)),
    ]);
    if (!raw) throw notFound();
    const d = applyOverride(raw, ov.override);
    return { id: r.pid, locale: context.locale, title: d.title, synopsis: d.synopsis, image: d.backdrop ?? d.poster, slug: ov.seo?.slug ?? d.slug, seo: ov.seo };
  },
  head: ({ loaderData: l }) => {
    if (!l) return { meta: [{ title: "Not found · MOROBEST" }, { name: "robots", content: "noindex" }] };
    return seoHead({ locale: l.locale, title: `${l.title} (Manga)`, description: (l.synopsis ?? `${l.title} on MOROBEST.`).slice(0, 160), image: l.image, path: `/manga/${l.slug}`, seo: l.seo });
  },
  notFoundComponent: () => <FullPageMessage code="404" title="This title could not be found." />,
  errorComponent: () => <FullPageMessage title="This page is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <AniDetailPage type="MANGA" id={Route.useLoaderData().id} />,
});

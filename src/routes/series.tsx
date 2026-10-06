import { createFileRoute } from "@tanstack/react-router";
import { TmdbWorldView } from "@/components/mb/Tmdb";
import { tmdbWorldQuery } from "@/features/tmdb/tmdb.functions";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/series")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tmdbWorldQuery("series", context.locale)),
  head: () => seo("Series — trending, airing & top rated", "Trending, popular, currently airing and top rated TV series with full seasons and episodes on MOROBEST."),
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  errorComponent: () => <FullPageMessage title="The catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <TmdbWorldView kind="series" grid="tv" />,
});

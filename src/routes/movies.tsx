import { createFileRoute } from "@tanstack/react-router";
import { TmdbWorldView } from "@/components/mb/Tmdb";
import { tmdbWorldQuery } from "@/features/tmdb/tmdb.functions";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/movies")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tmdbWorldQuery("movies", context.locale)),
  head: () => seo("Movies — trending, popular & classics", "Trending, popular, top rated, now playing and upcoming movies with real posters, cast and trailers on MOROBEST."),
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  errorComponent: () => <FullPageMessage title="The catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <TmdbWorldView kind="movies" grid="movie" />,
});

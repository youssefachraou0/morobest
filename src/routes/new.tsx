import { createFileRoute } from "@tanstack/react-router";
import { TmdbWorldView } from "@/components/mb/Tmdb";
import { tmdbWorldQuery } from "@/features/tmdb/tmdb.functions";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/new")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tmdbWorldQuery("new", context.locale)),
  head: () => seo("New releases", "The newest movies and series, now in cinemas and coming soon on MOROBEST."),
  pendingComponent: () => <StarLoader className="min-h-screen" />,
  errorComponent: () => <FullPageMessage title="The catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <TmdbWorldView kind="new"  />,
});

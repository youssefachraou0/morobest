import { createFileRoute } from "@tanstack/react-router";
import { AniWorld } from "@/components/mb/Ani";
import { aniHomeQuery } from "@/features/anilist/anilist.functions";
import { FullPageMessage } from "@/components/mb/States";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/anime/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(aniHomeQuery("ANIME")),
  head: () => seo("Anime — trending, airing & classics", "Discover trending, currently airing, top rated and classic anime with real metadata on MOROBEST."),
  errorComponent: () => <FullPageMessage title="The anime catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <AniWorld type="ANIME" />,
});

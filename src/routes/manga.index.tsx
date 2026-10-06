import { createFileRoute } from "@tanstack/react-router";
import { AniWorld } from "@/components/mb/Ani";
import { aniHomeQuery } from "@/features/anilist/anilist.functions";
import { FullPageMessage } from "@/components/mb/States";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/manga/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(aniHomeQuery("MANGA")),
  head: () => seo("Manga, Manhwa & Manhua", "Discover trending, popular and top rated manga, manhwa and manhua on MOROBEST."),
  errorComponent: () => <FullPageMessage title="The manga catalog is temporarily unavailable." body="Please try again in a moment." />,
  component: () => <AniWorld type="MANGA" />,
});

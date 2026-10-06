import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/features/library/useLibrary";
import { titlesQuery } from "@/features/catalog/queries";
import { PageHeader, EmptyState } from "@/components/mb/States";
import { PosterCard } from "@/components/mb/Cards";
import { StarLoader } from "@/components/mb/Brand";
import { mbButton } from "@/components/mb/Button";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: "My List · MOROBEST" }, { name: "description", content: "Your saved MOROBEST titles." }, { name: "robots", content: "noindex" }] }),
  component: Watchlist,
});

function Watchlist() {
  const { t } = useI18n();
  const lib = useLibrary();
  const ids = lib.watchlist;
  const cards = useQuery({ ...titlesQuery({ ids, limit: 100 }), enabled: ids.length > 0 });
  const ordered = ids.map((id) => cards.data?.find((c) => c.id === id)).filter(Boolean);
  return (
    <div>
      <PageHeader title={t.nav.watchlist} />
      <div className="px-4 py-6 sm:px-8 lg:px-14">
        {lib.loading || (ids.length > 0 && cards.isLoading) ? (
          <StarLoader />
        ) : ordered.length === 0 ? (
          <EmptyState title={t.empty.list} action={<Link to="/explore" className={mbButton({ variant: "outline" })}>{t.nav.explore}</Link>} />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 [&>a]:w-full">
            {ordered.map((x) => <PosterCard key={x!.id} title={x!} />)}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { titlesQuery } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { PosterCard, PosterSkeleton } from "@/components/mb/Cards";
import { EmptyState } from "@/components/mb/States";
import type { TitleKind } from "@/features/catalog/types";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const KINDS: TitleKind[] = ["movie", "series", "anime", "manga"];

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q.slice(0, 100) : undefined,
    kind: KINDS.includes(s.kind as TitleKind) ? (s.kind as TitleKind) : undefined,
  }),
  head: () => seo("Search", "Search MOROBEST for movies, series, anime, manga, Arabic and Ramadan titles."),
  component: SearchPage,
});

function SearchPage() {
  const { q = "", kind } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { t } = useI18n();
  const { maxAge } = useAuth();
  const [text, setText] = useState(q);

  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== q) navigate({ search: (s) => ({ ...s, q: text || undefined }), replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [text, q, navigate]);

  const res = useQuery({ ...titlesQuery({ q, kind, maxAge, limit: 60 }), enabled: q.trim().length > 0 });
  const kindLabel: Record<TitleKind, string> = { movie: t.nav.movies, series: t.nav.series, anime: t.nav.anime, manga: t.nav.manga };

  return (
    <div className="px-4 pb-10 pt-24 sm:px-8 lg:px-14">
      <label className="relative block">
        <span className="sr-only">{t.nav.search}</span>
        <SearchIcon className="absolute start-4 top-1/2 h-6 w-6 -translate-y-1/2 text-gold" />
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.empty.searchHint}
          className="h-16 w-full rounded-2xl border border-input bg-surface ps-14 pe-4 font-display text-2xl placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {[undefined, ...KINDS].map((k) => (
          <button
            key={k ?? "all"}
            onClick={() => navigate({ search: (s) => ({ ...s, kind: k }), replace: true })}
            className={cn("rounded-full border px-4 py-1.5 text-sm", kind === k ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {k ? kindLabel[k] : t.label.all}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {!q ? (
          <EmptyState title={t.nav.search} body={t.empty.searchHint} />
        ) : res.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={i} />)}</div>
        ) : res.data && res.data.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{res.data.length} {t.label.results}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 [&>a]:w-full">
              {res.data.map((x) => <PosterCard key={x.id} title={x} />)}
            </div>
          </>
        ) : (
          <EmptyState title={t.empty.search} />
        )}
      </div>
    </div>
  );
}

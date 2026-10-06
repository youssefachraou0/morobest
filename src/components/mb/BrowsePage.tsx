import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { taxonomyQuery, titlesQuery } from "@/features/catalog/queries";
import { nameOf } from "@/features/catalog/localize";
import type { ListParams, ListSort } from "@/features/catalog/types";
import { PageHeader, EmptyState } from "./States";
import { PosterCard, PosterSkeleton } from "./Cards";
import { cn } from "@/lib/utils";

export type BrowseSearch = { genre?: string; sort?: ListSort; year?: number; status?: string };

export function validateBrowseSearch(s: Record<string, unknown>): BrowseSearch {
  const sorts: ListSort[] = ["popular", "newest", "oldest", "rating", "az"];
  return {
    genre: typeof s.genre === "string" ? s.genre.slice(0, 40) : undefined,
    sort: sorts.includes(s.sort as ListSort) ? (s.sort as ListSort) : undefined,
    year: typeof s.year === "number" ? s.year : undefined,
    status: typeof s.status === "string" ? s.status.slice(0, 20) : undefined,
  };
}

export function BrowsePage({
  title, eyebrow, subtitle, base, search, onSearch, showStatus,
}: {
  title: string; eyebrow?: string; subtitle?: string; base: ListParams; search: BrowseSearch;
  onSearch: (s: BrowseSearch) => void; showStatus?: boolean;
}) {
  const { t, locale } = useI18n();
  const { maxAge } = useAuth();
  const tax = useQuery(taxonomyQuery());
  const params: ListParams = { ...base, ...search, maxAge: base.maxAge ?? maxAge, limit: 60 };
  const list = useQuery(titlesQuery(params));

  const sorts: [ListSort, string][] = [["popular", t.label.popular], ["newest", t.label.newest], ["rating", t.label.topRated], ["oldest", t.label.oldest], ["az", t.label.az]];
  const chip = (active: boolean) =>
    cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition", active ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30");

  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 py-3 sm:px-8 lg:px-14">
          <button className={chip(!search.genre)} onClick={() => onSearch({ ...search, genre: undefined })}>{t.label.all}</button>
          {(tax.data?.genres ?? []).map((g) => (
            <button key={g.slug} className={chip(search.genre === g.slug)} onClick={() => onSearch({ ...search, genre: g.slug })}>{nameOf(g, locale)}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-3 sm:px-8 lg:px-14">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t.label.sort}
            <select
              value={search.sort ?? "popular"}
              onChange={(e) => onSearch({ ...search, sort: e.target.value as ListSort })}
              className="rounded-md border border-input bg-surface px-2 py-1.5 text-foreground"
            >
              {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {showStatus && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t.label.status}
              <select
                value={search.status ?? ""}
                onChange={(e) => onSearch({ ...search, status: e.target.value || undefined })}
                className="rounded-md border border-input bg-surface px-2 py-1.5 text-foreground"
              >
                <option value="">{t.label.all}</option>
                <option value="airing">{t.label.airing}</option>
                <option value="completed">{t.label.completed}</option>
                <option value="released">{t.label.released}</option>
                <option value="upcoming">{t.label.upcoming}</option>
              </select>
            </label>
          )}
          {list.data && <span className="ms-auto text-sm text-muted-foreground">{list.data.length} {t.label.results}</span>}
        </div>
      </div>
      <div className="px-4 py-8 sm:px-8 lg:px-14">
        {list.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <PosterSkeleton key={i} />)}</div>
        ) : list.isError ? (
          <EmptyState title={t.error.generic} />
        ) : list.data && list.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 [&>a]:w-full">
            {list.data.map((x) => <PosterCard key={x.id} title={x} />)}
          </div>
        ) : (
          <EmptyState title={t.empty.generic} />
        )}
      </div>
    </div>
  );
}

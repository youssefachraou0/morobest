import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAnalyticsDashboard, type Dashboard } from "@/features/analytics/analytics.functions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCanonical } from "@/features/editorial/canonical";
import { FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { Stat, hm, pct, useRange } from "@/components/mb/AnalyticsBits";

export const Route = createFileRoute("/_authenticated/admin-analytics")({
  head: () => ({ meta: [{ title: "Analytics · MOROBEST Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const { isStaff, loading } = useAuth() as ReturnType<typeof useAuth> & { isStaff?: boolean; loading?: boolean };
  const { range, picker } = useRange();
  const fn = useServerFn(adminAnalyticsDashboard);
  const q = useQuery({ queryKey: ["admin-analytics", range], queryFn: () => fn({ data: range }), refetchInterval: 60_000, retry: false });
  if (!loading && isStaff === false) return <FullPageMessage title="This area is for MOROBEST staff only." />;
  if (q.error && (q.error as Error).message === "Forbidden") return <FullPageMessage title="This area is for MOROBEST staff only." />;
  const d = q.data;
  return (
    <div className="space-y-8 px-4 pb-16 pt-24 sm:px-8 lg:px-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-gold">← Dashboard</Link>
          <h1 className="font-display text-4xl">Analytics</h1>
          <p className="text-sm text-muted-foreground">First-party, pseudonymous viewing data. Crawlers are excluded. Raw events are kept 90 days; daily totals are kept long-term.</p>
        </div>
        {picker}
      </div>
      {q.isLoading || !d ? <StarLoader className="h-64" /> : <Body d={d} />}
    </div>
  );
}

function List({ title, rows, empty = "No data in this period." }: { title: string; rows: [string, string | number][]; empty?: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-display text-xl">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ol className="space-y-1.5 text-sm">{rows.map(([a, b], i) => <li key={i} className="flex justify-between gap-3"><span className="truncate">{a}</span><span className="tabular-nums text-muted-foreground">{b}</span></li>)}</ol>
      )}
    </section>
  );
}

function Body({ d }: { d: Dashboard }) {
  const canonical = useCanonical();
  const byKind = (k: string) => d.titles.filter((t) => t.kind === k).slice(0, 8).map((t) => [t.name, `${t.views} views · ${hm(t.watch_seconds)}`] as [string, string]);
  const ev = d.events ?? {};
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Stat label="Active viewers" value={d.active_viewers} hint="last 5 min" />
        <Stat label="Views today" value={d.views_today} />
        <Stat label="Views this week" value={d.views_week} />
        <Stat label="Views (range)" value={d.views} hint={`${d.unique_viewers} unique`} />
        <Stat label="Watch time" value={hm(d.watch_seconds)} />
        <Stat label="Page views" value={d.page_views} />
        <Stat label="Playback errors" value={d.errors} hint={`failure rate ${pct(d.errors, d.views + d.errors)}`} />
        <Stat label="Source fallbacks" value={d.fallbacks} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <List title="Most watched movies" rows={byKind("movie")} />
        <List title="Most watched series" rows={byKind("series")} />
        <List title="Most watched anime" rows={byKind("anime")} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 font-display text-xl">Trending on MOROBEST</h2>
          {d.trending.length === 0 ? <p className="text-sm text-muted-foreground">Not enough viewing activity yet.</p> : (
            <ol className="space-y-1.5 text-sm">{d.trending.map((t, i) => (
              <li key={t.key} className="flex justify-between gap-3"><Link {...canonical(t.ref)} className="truncate hover:text-gold">{i + 1}. {t.title}</Link><span className="tabular-nums text-muted-foreground">{t.score.toFixed(1)}</span></li>
            ))}</ol>
          )}
        </section>
        <List title="Top searches" rows={d.searches.map((s) => [s.q, s.n])} />
        <List title="Recent playback errors" rows={d.error_list.map((e) => [`${e.provider ?? "source"}: ${e.message}`, new Date(e.at).toLocaleString()])} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <List title="Subtitle languages" rows={d.subtitles.map((s) => [s.lang ?? "off", s.n])} />
        <List title="Audio languages" rows={d.audio.map((s) => [s.lang ?? "original", s.n])} />
        <List title="Engagement" rows={[
          ["Title impressions", ev.impression ?? 0], ["Title clicks", ev.click ?? 0], ["Search result clicks", ev.search_click ?? 0],
          ["Recommendation clicks", "see events"], ["Watch button clicks", ev.watch_click ?? 0], ["Continue Watching clicks", ev.continue_click ?? 0],
          ["Watchlist adds / removes", `${ev.watchlist_add ?? 0} / ${ev.watchlist_remove ?? 0}`], ["Favorites adds / removes", `${ev.favorite_add ?? 0} / ${ev.favorite_remove ?? 0}`],
          ["Autoplay next episode", ev.autoplay_next ?? 0], ["Pauses / resumes", `${ev.pause ?? 0} / ${ev.resume ?? 0}`], ["Completions", ev.complete ?? 0],
        ]} />
      </div>
      <section className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted-foreground"><tr>{["Title", "Views", "Unique", "Watch time", "Avg", "Completion", "Failure rate"].map((h) => <th key={h} className="p-2 text-start font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {d.titles.length === 0 ? <tr><td colSpan={7} className="p-4 text-muted-foreground">No playback in this period.</td></tr> : d.titles.map((t) => (
              <tr key={t.title_id} className="border-t border-border">
                <td className="p-2"><Link to="/title/$slug" params={{ slug: t.slug }} className="hover:text-gold">{t.name}</Link> <span className="text-xs text-muted-foreground">{t.kind}</span></td>
                <td className="p-2 tabular-nums">{t.views}</td><td className="p-2 tabular-nums">{t.unique}</td><td className="p-2 tabular-nums">{hm(t.watch_seconds)}</td>
                <td className="p-2 tabular-nums">{t.views ? hm(t.watch_seconds / t.views) : "—"}</td><td className="p-2 tabular-nums">{pct(t.completions, t.views)}</td>
                <td className="p-2 tabular-nums">{pct(t.errors, t.views + t.errors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

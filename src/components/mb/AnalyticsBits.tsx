import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminTitleAnalytics } from "@/features/analytics/analytics.functions";
import { field } from "./AdminBits";
import { StarLoader } from "./Brand";
import { cn } from "@/lib/utils";
import { dropOff } from "@/features/analytics/metrics";

export type Preset = "today" | "7d" | "30d" | "custom";
export function useRange() {
  const [preset, setPreset] = useState<Preset>("7d");
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [includeTest, setIncludeTest] = useState(false);
  const [custom, setCustom] = useState({ from: iso(new Date(Date.now() - 14 * 864e5)), to: iso(new Date()) });
  const range = useMemo(() => {
    const now = new Date();
    if (preset === "today") { const s = new Date(now); s.setHours(0, 0, 0, 0); return { from: s.toISOString(), to: new Date(now.getTime() + 60_000).toISOString() }; }
    if (preset === "7d") return { from: new Date(now.getTime() - 7 * 864e5).toISOString(), to: new Date(now.getTime() + 60_000).toISOString() };
    if (preset === "30d") return { from: new Date(now.getTime() - 30 * 864e5).toISOString(), to: new Date(now.getTime() + 60_000).toISOString() };
    // Custom range is inclusive of both days; a reversed range is swapped rather than producing an empty/invalid query.
    const [a, b] = [custom.from, custom.to].sort();
    return { from: new Date(a + "T00:00:00").toISOString(), to: new Date(new Date(b + "T00:00:00").getTime() + 864e5).toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, custom.from, custom.to, preset === "today" ? Math.floor(Date.now() / 60_000) : 0]);
  const rangeWithTest = useMemo(() => ({ ...range, includeTest }), [range, includeTest]);
  const picker = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      {(["today", "7d", "30d", "custom"] as const).map((p) => (
        <button key={p} onClick={() => setPreset(p)} className={cn("rounded-full border px-3 py-1 text-sm", preset === p ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground")}>
          {p === "today" ? "Today" : p === "7d" ? "7 days" : p === "30d" ? "30 days" : "Custom"}
        </button>
      ))}
      {preset === "custom" && (
        <>
          <input type="date" aria-label="From" className={cn(field, "w-40")} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <input type="date" aria-label="To" className={cn(field, "w-40")} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </>
      )}
      <label className="ms-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Include test traffic
      </label>
    </div>
  );
  return { range: rangeWithTest, picker, preset };
}

export const hm = (raw: number) => { const s = Number.isFinite(Number(raw)) ? Number(raw) : 0; const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
export const pct = (a: number, b: number) => (b > 0 && Number.isFinite(a / b) ? `${Math.min(100, Math.round((a / b) * 100))}%` : "—");

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Per-title viewing analytics: totals plus per-episode views, completion and drop-off for series. */
export function TitleAnalyticsView({ titleId }: { titleId: string }) {
  const { range, picker } = useRange();
  const fn = useServerFn(adminTitleAnalytics);
  const q = useQuery({ queryKey: ["admin-title-analytics", titleId, range], queryFn: () => fn({ data: { titleId, ...range } }) });
  const d = q.data;
  return (
    <div className="space-y-5">
      {picker}
      {q.isLoading ? <StarLoader className="h-40" /> : q.error ? <p className="text-destructive">{(q.error as Error).message}</p> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total views" value={d.views} />
            <Stat label="Unique viewers" value={d.unique} />
            <Stat label="Watch time" value={hm(d.watch_seconds)} />
            <Stat label="Avg watch time" value={d.views ? hm(d.watch_seconds / d.views) : "—"} />
            <Stat label="Completion rate" value={pct(d.completions, d.views)} />
            <Stat label="Failure rate" value={pct(d.failed, d.attempts)} hint={`${d.errors} errors · fallbacks that recovered don't count`} />
          </div>
          {d.episodes.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted-foreground"><tr>{["Episode", "Views", "Unique", "Watch time", "Completion", "Drop-off vs E1", "From previous"].map((h) => <th key={h} className="p-2 text-start font-normal">{h}</th>)}</tr></thead>
                <tbody>
                  {d.episodes.map((e, i) => {
                    const prev = d.episodes[i - 1];
                    const first = d.episodes[0]!;
                    const drop = prev && prev.unique > 0 ? `${Math.max(0, Math.round((1 - e.unique / prev.unique) * 100))}%` : "—";
                    const dropFirst = i > 0 && first.unique > 0 ? `${Math.round(dropOff([first.unique, e.unique])[1]! * 100)}%` : "—";
                    return (
                      <tr key={e.episode_id} className="border-t border-border">
                        <td className="p-2">S{e.season}·E{e.number} <span className="text-muted-foreground">{e.title}</span></td>
                        <td className="p-2 tabular-nums">{e.views}</td><td className="p-2 tabular-nums">{e.unique}</td><td className="p-2 tabular-nums">{hm(e.watch_seconds ?? 0)}</td>
                        <td className="p-2 tabular-nums">{pct(e.completions, e.views)}</td><td className="p-2 tabular-nums">{dropFirst}</td><td className="p-2 tabular-nums">{drop}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

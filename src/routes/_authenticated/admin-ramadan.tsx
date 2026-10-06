import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { adminAssignRamadan, adminRamadanAssignments, adminRamadanSeasons, adminRemoveRamadan, adminSaveRamadanSeason, adminSearchExternal } from "@/features/editorial/admin.functions";
import { PageHeader, EmptyState } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { mbButton } from "@/components/mb/Button";
import { Badge } from "@/components/mb/Cards";
import { field } from "@/components/mb/AdminBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin-ramadan")({
  head: () => ({ meta: [{ title: "Ramadan · MOROBEST Admin" }, { name: "description", content: "Create Ramadan seasons and assign titles by country." }, { name: "robots", content: "noindex" }] }),
  component: RamadanAdmin,
});

export const COUNTRIES: [string, string][] = [
  ["MA", "Morocco"], ["EG", "Egypt"], ["DZ", "Algeria"], ["TN", "Tunisia"], ["SA", "Saudi Arabia"], ["AE", "UAE"], ["KW", "Kuwait"], ["QA", "Qatar"], ["BH", "Bahrain"], ["OM", "Oman"],
  ["SY", "Syria"], ["LB", "Lebanon"], ["IQ", "Iraq"], ["LY", "Libya"], ["JO", "Jordan"], ["PS", "Palestine"], ["SD", "Sudan"], ["YE", "Yemen"], ["MR", "Mauritania"],
];

type Season = { id?: string; year: number; name_ar: string; name_fr: string; name_en: string; starts_on: string; ends_on: string; hero_image: string; description: string; is_active: boolean; is_featured: boolean; archived_at?: string | null };
const blank = (y: number): Season => ({ year: y, name_ar: `رمضان ${y}`, name_fr: `Ramadan ${y}`, name_en: `Ramadan ${y}`, starts_on: `${y}-02-01`, ends_on: `${y}-03-02`, hero_image: "", description: "", is_active: true, is_featured: false });

function RamadanAdmin() {
  const { canManageContent, ready, rolesReady } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(adminRamadanSeasons);
  const save = useServerFn(adminSaveRamadanSeason);
  const seasons = useQuery({ queryKey: ["admin", "ramadan-seasons"], queryFn: () => list(), enabled: canManageContent });
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<Season | null>(null);
  useEffect(() => { if (!sel && seasons.data?.[0]) setSel(seasons.data[0].id); }, [seasons.data, sel]);
  const m = useMutation({
    mutationFn: (s: Season & { archived?: boolean }) => save({ data: {
      id: s.id, year: s.year, name_ar: s.name_ar || null, name_fr: s.name_fr || null, name_en: s.name_en || null, starts_on: s.starts_on, ends_on: s.ends_on,
      hero_image: s.hero_image || null, description: s.description || null, is_active: s.is_active, is_featured: s.is_featured, archived: s.archived,
    } }),
    onSuccess: (r) => { toast.success("Season saved"); setEdit(null); setSel(r.id); qc.invalidateQueries({ queryKey: ["admin", "ramadan-seasons"] }); qc.invalidateQueries({ queryKey: ["ramadan-hub"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!ready || !rolesReady) return <StarLoader className="min-h-screen" />;
  if (!canManageContent) return <div className="pt-32"><EmptyState title="Content managers only" body="Your account cannot manage content." /></div>;
  const cur = seasons.data?.find((s) => s.id === sel);
  return (
    <div className="pb-16">
      <PageHeader eyebrow="Admin · Content" title="Ramadan" />
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-8">
        {(seasons.data ?? []).map((s) => (
          <button key={s.id} onClick={() => setSel(s.id)} className={cn("rounded-full border px-4 py-1.5 text-sm", sel === s.id ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground", s.archived_at && "line-through opacity-60")}>
            {s.year}{s.is_featured ? " ★" : ""}
          </button>
        ))}
        <button className={mbButton({ size: "sm", variant: "outline" })} onClick={() => setEdit(blank(Math.max(new Date().getFullYear(), ...(seasons.data ?? []).map((s) => s.year + 1))))}>Create Ramadan Season</button>
        <Link to="/admin-content" className="ms-auto text-sm text-muted-foreground hover:text-gold">← Content</Link>
      </div>
      {edit && <SeasonForm s={edit} onCancel={() => setEdit(null)} onSave={(s) => m.mutate(s)} busy={m.isPending} />}
      {cur && !edit && (
        <div className="px-4 pt-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl">{cur.name_en ?? `Ramadan ${cur.year}`}</h2>
            <span className="text-sm text-muted-foreground">{cur.starts_on} → {cur.ends_on}</span>
            {cur.is_active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>}
            {cur.archived_at && <Badge tone="red">archived</Badge>}
            <button className={mbButton({ size: "sm", variant: "outline" })} onClick={() => setEdit({ ...blank(cur.year), ...Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, v ?? ""])), is_active: cur.is_active, is_featured: cur.is_featured, year: cur.year } as Season)}>Edit</button>
            <button className={mbButton({ size: "sm", variant: "ghost" })} onClick={() => m.mutate({ ...(cur as Season), hero_image: cur.hero_image ?? "", description: cur.description ?? "", archived: !cur.archived_at })}>{cur.archived_at ? "Unarchive" : "Archive"}</button>
            <Link to="/ramadan/$year" params={{ year: String(cur.year) }} className="text-sm text-gold hover:underline">View public page ↗</Link>
          </div>
          <Assignments seasonId={cur.id} year={cur.year} />
        </div>
      )}
      {seasons.data?.length === 0 && !edit && <div className="px-4 py-10"><EmptyState title="No Ramadan seasons" body="Create your first season." /></div>}
    </div>
  );
}

function SeasonForm({ s, onSave, onCancel, busy }: { s: Season; onSave: (s: Season) => void; onCancel: () => void; busy: boolean }) {
  const [f, setF] = useState(s);
  const I = (k: keyof Season, label: string, type = "text") => (
    <label className="block text-sm">{label}<input type={type} className={cn(field, "mt-1")} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value })} aria-label={label} /></label>
  );
  return (
    <div className="mx-4 mt-6 grid max-w-4xl gap-3 rounded-xl border border-border bg-surface p-5 sm:mx-8 md:grid-cols-3">
      {I("year", "Year", "number")}{I("starts_on", "Start date", "date")}{I("ends_on", "End date", "date")}
      {I("name_ar", "Name (AR)")}{I("name_fr", "Name (FR)")}{I("name_en", "Name (EN)")}
      <div className="md:col-span-3">{I("hero_image", "Hero image URL")}</div>
      <label className="block text-sm md:col-span-3">Description<textarea className={cn(field, "mt-1 h-20 py-2")} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Description" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="accent-[var(--gold)]" />Active (visible publicly)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_featured} onChange={(e) => setF({ ...f, is_featured: e.target.checked })} className="accent-[var(--gold)]" />Featured (default on /ramadan)</label>
      <div className="flex gap-2 md:col-span-3"><button className={mbButton()} disabled={busy} onClick={() => onSave(f)}>Save season</button><button className={mbButton({ variant: "ghost" })} onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function Assignments({ seasonId, year }: { seasonId: string; year: number }) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminRamadanAssignments);
  const assignFn = useServerFn(adminAssignRamadan);
  const removeFn = useServerFn(adminRemoveRamadan);
  const searchFn = useServerFn(adminSearchExternal);
  const [country, setCountry] = useState("");
  const [source, setSource] = useState<"tmdb" | "morobest">("tmdb");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [assignCountry, setAssignCountry] = useState("MA");
  const rows = useQuery({ queryKey: ["admin", "ramadan-assign", seasonId], queryFn: () => listFn({ data: { seasonId } }) });
  const hits = useQuery({ queryKey: ["admin", "ramadan-search", source, term], queryFn: () => searchFn({ data: { source, q: term } }), enabled: term.length > 0 });
  const done = () => { qc.invalidateQueries({ queryKey: ["admin", "ramadan-assign", seasonId] }); qc.invalidateQueries({ queryKey: ["ramadan-hub"] }); };
  const err = (e: unknown) => toast.error((e as Error).message);
  type Row = { id?: string; source: "tmdb" | "morobest"; pid: string; mediaType: "movie" | "tv"; country: string | null; featured: boolean; ord: number; airTime: string | null; releaseSchedule: string | null; notes: string | null; status: "upcoming" | "airing" | "completed" };
  const mAssign = useMutation({ mutationFn: (r: Row) => assignFn({ data: { seasonId, ...r } }), onSuccess: () => { toast.success("Saved"); done(); }, onError: err });
  const mRemove = useMutation({ mutationFn: (id: string) => removeFn({ data: { id } }), onSuccess: () => { toast.success("Removed"); done(); }, onError: err });
  const list = (rows.data ?? []).filter((r) => !country || r.country_code === country);
  const toRow = (r: any): Row => ({ id: r.id, source: r.provider, pid: r.provider_id, mediaType: r.media_type, country: r.country_code, featured: r.featured, ord: r.ord, airTime: r.air_time, releaseSchedule: r.release_schedule, notes: r.notes, status: r.status });
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <select className={cn(field, "w-48")} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filter by country">
            <option value="">All countries</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">{list.length} title(s) in Ramadan {year}</span>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground"><tr>{["", "Title", "Country", "Status", "Air time", "Schedule", "Order", "Featured", "Notes", ""].map((h, i) => <th key={i} className="p-2 text-start font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => {
                const row = toRow(r);
                const upd = (p: Partial<Row>) => mAssign.mutate({ ...row, ...p });
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2">{r.poster ? <img src={r.poster} alt="" className="h-12 w-8 rounded object-cover" /> : null}</td>
                    <td className="p-2"><span className="font-medium">{r.label}</span><span className="block text-xs text-muted-foreground">{r.provider} #{String(r.provider_id).slice(0, 8)}</span></td>
                    <td className="p-2"><select className={cn(field, "h-8 w-32")} value={r.country_code ?? ""} onChange={(e) => upd({ country: e.target.value || null })} aria-label="Country"><option value="">—</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></td>
                    <td className="p-2"><select className={cn(field, "h-8 w-28")} value={r.status} onChange={(e) => upd({ status: e.target.value as Row["status"] })} aria-label="Status">{["upcoming", "airing", "completed"].map((s) => <option key={s}>{s}</option>)}</select></td>
                    <td className="p-2"><input className={cn(field, "h-8 w-20")} defaultValue={r.air_time ?? ""} onBlur={(e) => e.target.value !== (r.air_time ?? "") && upd({ airTime: e.target.value || null })} placeholder="21:00" aria-label="Air time" /></td>
                    <td className="p-2"><input className={cn(field, "h-8 w-36")} defaultValue={r.release_schedule ?? ""} onBlur={(e) => e.target.value !== (r.release_schedule ?? "") && upd({ releaseSchedule: e.target.value || null })} placeholder="Daily after iftar" aria-label="Release schedule" /></td>
                    <td className="p-2"><input type="number" className={cn(field, "h-8 w-16")} defaultValue={r.ord} onBlur={(e) => Number(e.target.value) !== r.ord && upd({ ord: Number(e.target.value) || 0 })} aria-label="Display order" /></td>
                    <td className="p-2"><input type="checkbox" checked={r.featured} onChange={(e) => upd({ featured: e.target.checked })} aria-label="Featured" className="accent-[var(--gold)]" /></td>
                    <td className="p-2"><input className={cn(field, "h-8 w-32")} defaultValue={r.notes ?? ""} onBlur={(e) => e.target.value !== (r.notes ?? "") && upd({ notes: e.target.value || null })} aria-label="Notes" /></td>
                    <td className="p-2"><button className={mbButton({ size: "sm", variant: "ghost" })} onClick={() => mRemove.mutate(r.id)}>Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <p className="p-6 text-muted-foreground">No titles assigned{country ? " for this country" : ""}.</p>}
        </div>
      </section>
      <aside className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-display text-xl">Assign a title</h3>
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
          <select className={field} value={source} onChange={(e) => setSource(e.target.value as "tmdb" | "morobest")} aria-label="Search source"><option value="tmdb">Search TMDB</option><option value="morobest">Search MOROBEST titles</option></select>
          <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Series or movie name…" aria-label="Search titles to assign" />
          <select className={field} value={assignCountry} onChange={(e) => setAssignCountry(e.target.value)} aria-label="Assign country">{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
          <button className={cn(mbButton({ size: "sm" }), "w-full")} type="submit">Search</button>
        </form>
        <ul className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto">
          {(hits.data ?? []).map((h) => {
            const isTm = source === "tmdb";
            const pid = isTm ? String(h.pid) : h.titleId!;
            const mediaType: "movie" | "tv" = isTm ? (h.ct === "movie" ? "movie" : "tv") : (h.originalTitle === "movie" ? "movie" : "tv");
            return (
              <li key={pid} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                {h.poster && <img src={h.poster} alt="" className="h-12 w-8 rounded object-cover" />}
                <span className="min-w-0 flex-1"><span className="line-clamp-1">{h.title}</span><span className="text-xs text-muted-foreground">{h.year ?? "—"} · {mediaType}</span></span>
                <button className={mbButton({ size: "sm", variant: "outline" })} onClick={() => mAssign.mutate({ source, pid, mediaType, country: assignCountry, featured: false, ord: (rows.data?.length ?? 0) + 1, airTime: null, releaseSchedule: null, notes: null, status: "airing" })}>Assign</button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { adminDeleteTitle, adminListTitles, adminSearchExternal, adminSetTitleStatus } from "@/features/editorial/admin.functions";
import { PageHeader, EmptyState } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { mbButton } from "@/components/mb/Button";
import { Badge } from "@/components/mb/Cards";
import { cn } from "@/lib/utils";
import { AuditTable, field, keyOf } from "@/components/mb/AdminBits";

type Tab = "linking" | "titles" | "audit";
export const Route = createFileRoute("/_authenticated/admin-content")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: s.tab === "titles" || s.tab === "audit" ? s.tab : undefined }),
  head: () => ({ meta: [{ title: "Content · MOROBEST Admin" }, { name: "description", content: "Link TMDB and AniList titles to MOROBEST content, clean up demo titles and review admin activity." }, { name: "robots", content: "noindex" }] }),
  component: ContentAdmin,
});


function ContentAdmin() {
  const { canManageContent, ready, rolesReady } = useAuth();
  const { tab = "linking" } = Route.useSearch();
  if (!ready || !rolesReady) return <StarLoader className="min-h-screen" />;
  if (!canManageContent) return <div className="pt-32"><EmptyState title="Content managers only" body="Your account cannot manage content." /></div>;
  return (
    <div className="pb-16">
      <PageHeader eyebrow="Admin · Content" title="Content" />
      <div className="flex flex-wrap gap-2 px-4 sm:px-8">
        {([["linking", "Title Linking"], ["titles", "MOROBEST titles"], ["audit", "Audit log"]] as const).map(([k, l]) => (
          <Link key={k} to="/admin-content" search={{ tab: k === "linking" ? undefined : k }} className={cn("rounded-full border px-4 py-1.5 text-sm", tab === k ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground")}>{l}</Link>
        ))}
        <Link to="/admin-ramadan" className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Ramadan</Link>
        <Link to="/admin" className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
      </div>
      <div className="px-4 pt-6 sm:px-8">
        {tab === "linking" && <Linking />}
        {tab === "titles" && <Titles />}
        {tab === "audit" && <Audit />}
      </div>
    </div>
  );
}

function Linking() {
  const [source, setSource] = useState<"tmdb" | "anilist">("tmdb");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const search = useServerFn(adminSearchExternal);
  const res = useQuery({ queryKey: ["admin", "ext-search", source, term], queryFn: () => search({ data: { source, q: term } }), enabled: term.length > 0 });
  return (
    <div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <select className={cn(field, "w-40")} value={source} onChange={(e) => setSource(e.target.value as "tmdb" | "anilist")} aria-label="Provider">
          <option value="tmdb">TMDB (movies, series)</option><option value="anilist">AniList (anime, manga)</option>
        </select>
        <input className={cn(field, "max-w-md flex-1")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search provider titles…" aria-label="Search provider" />
        <button className={mbButton()} type="submit">Search</button>
      </form>
      {res.isLoading && <StarLoader className="py-10" />}
      {res.isError && <p className="mt-4 text-destructive">{(res.error as Error).message}</p>}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted-foreground"><tr>{["", "Title", "Original title", "Year", "Provider", "ID", "Type", "MOROBEST link", ""].map((h, i) => <th key={i} className="p-3 text-start font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {(res.data ?? []).map((h) => (
              <tr key={`${h.ct}-${h.pid}`} className="border-t border-border">
                <td className="p-2">{h.poster ? <img src={h.poster} alt="" className="h-14 w-10 rounded object-cover" /> : <div className="h-14 w-10 rounded bg-surface-2" />}</td>
                <td className="p-3 font-medium">{h.title}</td>
                <td className="p-3 text-muted-foreground">{h.originalTitle}</td>
                <td className="p-3">{h.year ?? "—"}</td>
                <td className="p-3 uppercase">{source}</td>
                <td className="p-3 font-mono text-xs">{h.pid}</td>
                <td className="p-3">{h.ct}</td>
                <td className="p-3">{h.linkedTitle ? <Badge tone="green">{h.linkedTitle.name}</Badge> : <span className="text-muted-foreground">Not linked</span>}</td>
                <td className="p-3"><Link to="/admin-title/$key" params={{ key: keyOf(h.ct!, h.pid!) }} className={mbButton({ size: "sm", variant: "outline" })}>Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {term && res.data?.length === 0 && <p className="p-6 text-muted-foreground">No provider results.</p>}
        {!term && <p className="p-6 text-muted-foreground">Search TMDB or AniList, then open a title to link it, create a MOROBEST record, edit translations, SEO, episodes and Ramadan placement.</p>}
      </div>
    </div>
  );
}

function Titles() {
  const { isSuperAdmin } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const qc = useQueryClient();
  const list = useServerFn(adminListTitles);
  const setStatus = useServerFn(adminSetTitleStatus);
  const del = useServerFn(adminDeleteTitle);
  const q = useQuery({ queryKey: ["admin", "titles-list", showDemo], queryFn: () => list({ data: { showDemo } }) });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "titles-list"] });
  const status = useMutation({ mutationFn: (v: { titleId: string; status?: "draft" | "published" | "hidden" | "archived"; isDemo?: boolean }) => setStatus({ data: v }), onSuccess: () => { toast.success("Saved"); done(); }, onError: (e) => toast.error((e as Error).message) });
  const remove = useMutation({ mutationFn: (titleId: string) => del({ data: { titleId } }), onSuccess: () => { toast.success("Deleted permanently"); done(); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} className="accent-[var(--gold)]" /> Show Demo/Test Content</label>
      <p className="mt-1 text-xs text-muted-foreground">Demo titles are never shown to the public. Only published, non-demo titles appear on the site.</p>
      {q.isLoading ? <StarLoader className="py-10" /> : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground"><tr>{["Title", "Kind", "Year", "Links", "Videos", "Status", "Demo", ""].map((h) => <th key={h} className="p-3 text-start font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {(q.data ?? []).map((t) => {
                const l = t.links[0];
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-3">{l ? <Link to="/admin-title/$key" params={{ key: keyOf(l.content_type, l.provider_id) }} className="hover:text-gold">{t.name}</Link> : t.name}{t.isDemo && <Badge tone="red" className="ms-2">DEMO</Badge>}</td>
                    <td className="p-3">{t.kind}</td>
                    <td className="p-3">{t.year ?? "—"}</td>
                    <td className="p-3 text-xs">{t.links.map((x) => `${x.provider}:${x.provider_id}`).join(", ") || "—"}</td>
                    <td className="p-3 text-xs">{t.realSources} real · {t.testSources} test</td>
                    <td className="p-3">
                      <select className={cn(field, "h-8 w-32")} value={t.status} onChange={(e) => status.mutate({ titleId: t.id, status: e.target.value as "published" })} aria-label="Status">
                        {["draft", "published", "hidden", "archived"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-3"><input type="checkbox" checked={t.isDemo} onChange={(e) => status.mutate({ titleId: t.id, isDemo: e.target.checked })} aria-label="Demo" className="accent-[var(--gold)]" /></td>
                    <td className="p-3">
                      {isSuperAdmin && t.links.length === 0 && t.realSources === 0 && (
                        <button className={mbButton({ size: "sm", variant: "ghost" })} onClick={() => { if (confirm(`Permanently delete "${t.name}"? This cannot be undone.`)) remove.mutate(t.id); }}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {q.data?.length === 0 && <p className="p-6 text-muted-foreground">{showDemo ? "No titles." : "No production MOROBEST titles yet. Create one from Title Linking."}</p>}
        </div>
      )}
    </div>
  );
}

function Audit() { return <AuditTable />; }

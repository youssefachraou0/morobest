import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  adminContentDetail, adminCreateAndLink, adminEpisodeMapping, adminLinkExisting, adminRefresh, adminSaveOverride, adminSaveSeo,
  adminSearchExternal, adminSetEpisodeLink, adminSetTitleStatus, adminSyncEpisodes, adminUnlink,
} from "@/features/editorial/admin.functions";
import { CONTENT_TYPES, type ContentType } from "@/features/editorial/editorial.functions";
import { EmptyState, FullPageMessage } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { mbButton } from "@/components/mb/Button";
import { Badge } from "@/components/mb/Cards";
import { AuditTable, field } from "@/components/mb/AdminBits";
import { cn } from "@/lib/utils";
import { validateSlug } from "@/features/editorial/slug";

const TABS = ["overview", "metadata", "localization", "video", "subtitles", "audio", "episodes", "ramadan", "seo", "availability", "analytics", "audit"] as const;
type Tab = (typeof TABS)[number];
const parseKey = (k: string) => {
  const m = k.match(/^(movie|series|anime|manga)-(\d+)$/);
  return m ? { ct: m[1] as ContentType, pid: Number(m[2]) } : null;
};

export const Route = createFileRoute("/_authenticated/admin-title/$key")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : undefined }),
  head: () => ({ meta: [{ title: "Title · MOROBEST Admin" }, { name: "description", content: "Manage one title: link, translations, SEO, episodes, Ramadan and videos." }, { name: "robots", content: "noindex" }] }),
  component: TitleAdmin,
});

function TitleAdmin() {
  const { key } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const { canManageContent, ready, rolesReady } = useAuth();
  const ext = parseKey(key);
  const detailFn = useServerFn(adminContentDetail);
  const q = useQuery({ queryKey: ["admin", "content", key], queryFn: () => detailFn({ data: ext! }), enabled: !!ext && canManageContent });
  if (!ready || !rolesReady) return <StarLoader className="min-h-screen" />;
  if (!canManageContent) return <div className="pt-32"><EmptyState title="Content managers only" body="Your account cannot manage content." /></div>;
  if (!ext || !CONTENT_TYPES.includes(ext.ct)) return <FullPageMessage code="404" title="Unknown title key." />;
  if (q.isLoading) return <StarLoader className="min-h-screen" />;
  if (q.isError || !q.data) return <FullPageMessage title="Could not load this title." body={(q.error as Error)?.message} />;
  const d = q.data;
  const publicPath = ext.ct === "movie" ? "/movie/$slug" : ext.ct === "series" ? "/tv/$slug" : ext.ct === "anime" ? "/anime/$slug" : "/manga/$slug";
  const publicSlug = d.seo?.slug ?? d.meta?.slug ?? String(ext.pid);
  const titleId = d.link?.title_id ?? null;
  return (
    <div className="pb-16 pt-24">
      <div className="flex flex-wrap items-end gap-6 px-4 sm:px-8">
        {d.meta?.poster && <img src={d.meta.poster} alt="" className="w-28 rounded-lg ring-1 ring-gold/30" />}
        <div className="min-w-0">
          <Link to="/admin-content" className="text-xs text-muted-foreground hover:text-gold">← Content</Link>
          <h1 className="font-display text-4xl font-semibold">{d.meta?.title ?? `#${ext.pid}`}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge>{d.provider.toUpperCase()} #{ext.pid}</Badge><Badge>{ext.ct}</Badge>
            {d.link ? <Badge tone="green">Linked · {d.link.titles?.original_title}</Badge> : <Badge tone="red">Not linked</Badge>}
            {d.link && <Badge tone={d.link.titles?.content_status === "published" ? "green" : "gold"}>{d.link.titles?.content_status}</Badge>}
            <Link to={publicPath} params={{ slug: publicSlug }} className="text-gold hover:underline">View public page ↗</Link>
          </p>
        </div>
      </div>
      <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-8">
        {TABS.map((t) => (
          <Link key={t} to="/admin-title/$key" params={{ key }} search={{ tab: t === "overview" ? undefined : t }} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm capitalize", tab === t ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "episodes" ? "Seasons & Episodes" : t === "metadata" ? "External metadata" : t === "video" ? "Video sources" : t === "audit" ? "Audit log" : t}
          </Link>
        ))}
      </div>
      <div className="px-4 pt-6 sm:px-8">
        {tab === "overview" && <Overview k={key} ext={ext} d={d} />}
        {tab === "metadata" && <Metadata ext={ext} d={d} />}
        {tab === "localization" && <Localization k={key} ext={ext} d={d} />}
        {tab === "seo" && <Seo k={key} ext={ext} d={d} currentSlug={publicSlug} />}
        {tab === "episodes" && (ext.ct === "series" ? <Episodes ext={ext} seasons={d.meta?.seasons ?? []} linked={!!titleId} /> : <p className="text-muted-foreground">Only TMDB series have seasons and episodes.</p>)}
        {tab === "ramadan" && <RamadanTab d={d} />}
        {(tab === "video" || tab === "subtitles" || tab === "audio" || tab === "availability") && <MediaTab tab={tab} d={d} />}
        {tab === "analytics" && <p className="text-muted-foreground">Viewing analytics are not collected yet. Watch progress is stored per profile and will feed this view once analytics are enabled.</p>}
        {tab === "audit" && <AuditTable contentId={d.ref} />}
      </div>
    </div>
  );
}

type D = Awaited<ReturnType<typeof adminContentDetail>>;
type Ext = { ct: ContentType; pid: number };

function useInvalidate(k: string) {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["admin", "content", k] }); qc.invalidateQueries({ queryKey: ["admin", "audit"] }); qc.invalidateQueries({ queryKey: ["overlay"] }); };
}

function Overview({ k, ext, d }: { k: string; ext: Ext; d: D }) {
  const done = useInvalidate(k);
  const create = useServerFn(adminCreateAndLink);
  const link = useServerFn(adminLinkExisting);
  const unlink = useServerFn(adminUnlink);
  const status = useServerFn(adminSetTitleStatus);
  const refresh = useServerFn(adminRefresh);
  const search = useServerFn(adminSearchExternal);
  const [dups, setDups] = useState<{ id: string; original_title: string; year: number | null }[] | null>(null);
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState("");
  const internal = useQuery({ queryKey: ["admin", "internal-search", q], queryFn: () => search({ data: { source: "morobest", q } }), enabled: pick && q.length > 1 });
  const err = (e: unknown) => toast.error((e as Error).message);
  const mCreate = useMutation({
    mutationFn: (force: boolean) => create({ data: { ...ext, force } }),
    onSuccess: (r) => { if (!r.ok) setDups(r.duplicates); else { setDups(null); toast.success(`Created MOROBEST title ${r.slug}`); done(); } }, onError: err,
  });
  const mLink = useMutation({ mutationFn: (titleId: string) => link({ data: { ...ext, titleId } }), onSuccess: () => { toast.success("Linked"); setPick(false); setDups(null); done(); }, onError: err });
  const mUnlink = useMutation({ mutationFn: () => unlink({ data: ext }), onSuccess: () => { toast.success("Unlinked"); done(); }, onError: err });
  const mStatus = useMutation({ mutationFn: (s: "draft" | "published" | "hidden" | "archived") => status({ data: { titleId: d.link!.title_id, status: s } }), onSuccess: () => { toast.success("Status saved"); done(); }, onError: err });
  const mRefresh = useMutation({ mutationFn: (what: "metadata" | "images" | "credits" | "episodes") => refresh({ data: { ...ext, what } }), onSuccess: () => { toast.success("Provider data will be re-fetched. MOROBEST edits are untouched."); done(); }, onError: err });
  const ready = d.sources.filter((s) => s.is_active && s.status === "ready");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">MOROBEST link</h2>
        {d.link ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>Linked to <b>{d.link.titles?.original_title}</b> ({d.link.titles?.year ?? "—"}) · slug <code>{d.link.titles?.slug}</code>{d.link.titles?.is_demo && <Badge tone="red" className="ms-2">DEMO</Badge>}</p>
            <p className="text-muted-foreground">Linked {new Date(d.link.linked_at).toLocaleString()}</p>
            <label className="flex items-center gap-2">Publication
              <select className={cn(field, "h-9 w-36")} value={d.link.titles?.content_status} onChange={(e) => mStatus.mutate(e.target.value as "published")} aria-label="Publication status">
                {["draft", "published", "hidden", "archived"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <p>Video: {ready.filter((s) => !s.is_test_source).length > 0 ? <Badge tone="green">{ready.filter((s) => !s.is_test_source).length} ready source(s)</Badge> : <Badge tone="red">No playable public video</Badge>} {ready.some((s) => s.is_test_source) && <Badge tone="gold">test source</Badge>}</p>
            <div className="flex flex-wrap gap-2">
              <button className={mbButton({ variant: "outline", size: "sm" })} onClick={() => setPick(true)}>Change Link</button>
              <button className={mbButton({ variant: "ghost", size: "sm" })} onClick={() => { if (confirm("Unlink this provider title? Videos stay on the MOROBEST title.")) mUnlink.mutate(); }}>Unlink</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-muted-foreground">Not linked. The public page shows metadata only, without a Watch button.</p>
            <div className="flex flex-wrap gap-2">
              <button className={mbButton({ size: "sm" })} disabled={mCreate.isPending} onClick={() => mCreate.mutate(false)}>Create &amp; Link</button>
              <button className={mbButton({ variant: "outline", size: "sm" })} onClick={() => setPick(true)}>Link Existing</button>
            </div>
          </div>
        )}
        {dups && (
          <div className="mt-4 rounded-lg border border-gold/50 bg-gold-soft p-3 text-sm">
            <p className="font-medium text-gold">Possible duplicates found</p>
            <ul className="mt-2 space-y-1">{dups.map((x) => <li key={x.id} className="flex items-center justify-between gap-2">{x.original_title} ({x.year ?? "—"})<button className={mbButton({ size: "sm", variant: "outline" })} onClick={() => mLink.mutate(x.id)}>Link this one</button></li>)}</ul>
            <button className={cn(mbButton({ size: "sm", variant: "ghost" }), "mt-2")} onClick={() => mCreate.mutate(true)}>Create a new title anyway</button>
          </div>
        )}
        {!d.link && !dups && d.duplicates.length > 0 && (
          <p className="mt-3 text-xs text-gold">Heads-up: {d.duplicates.length} similar MOROBEST title(s) exist — {d.duplicates.map((x) => `${x.original_title} (${x.year ?? "—"})${x.linked ? " · already linked" : ""}`).join(", ")}.</p>
        )}
        {pick && (
          <div className="mt-4 space-y-2">
            <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search MOROBEST titles…" aria-label="Search MOROBEST titles" autoFocus />
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-border">
              {(internal.data ?? []).map((t) => (
                <li key={t.titleId} className="flex items-center justify-between gap-2 border-b border-border p-2 text-sm last:border-0">
                  <span>{t.title} · {t.originalTitle} · {t.year ?? "—"}</span>
                  <button className={mbButton({ size: "sm", variant: "outline" })} onClick={() => mLink.mutate(t.titleId!)}>Link</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">Provider sync</h2>
        <p className="mt-1 text-sm text-muted-foreground">Re-fetches provider data only. Custom titles, descriptions, SEO, Ramadan assignments, videos, subtitles and collections are never overwritten.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["metadata", "images", "credits"] as const).map((w) => <button key={w} className={mbButton({ variant: "outline", size: "sm" })} onClick={() => mRefresh.mutate(w)}>Refresh {w}</button>)}
          {ext.ct === "series" && <button className={mbButton({ variant: "outline", size: "sm" })} onClick={() => mRefresh.mutate("episodes")}>Refresh episodes</button>}
        </div>
        <h3 className="mt-6 font-medium">Overrides in use</h3>
        <p className="mt-1 text-sm text-muted-foreground">Translations: {d.overrides.map((o) => o.locale.toUpperCase()).join(", ") || "none"} · SEO: {d.seo ? "custom" : "auto"} · Ramadan: {d.ramadan.length || "none"}</p>
      </section>
    </div>
  );
}

function Metadata({ ext, d }: { ext: Ext; d: D }) {
  if (!d.meta) return <p className="text-muted-foreground">Provider metadata is temporarily unavailable.</p>;
  const rows: [string, string | number | null][] = [["Provider", d.provider], ["Provider ID", ext.pid], ["Type", ext.ct], ["Title", d.meta.title], ["Original title", d.meta.originalTitle], ["Year", d.meta.year], ["Provider slug", d.meta.slug], ["Seasons", d.meta.seasons.length || null]];
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
      <dl className="space-y-2 text-sm">{rows.filter(([, v]) => v != null).map(([k, v]) => <div key={k} className="flex gap-3 border-b border-border/60 py-1"><dt className="w-32 text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{d.meta.overview ?? "No overview from the provider."}</p>
    </div>
  );
}

function Localization({ k, ext, d }: { k: string; ext: Ext; d: D }) {
  const [loc, setLoc] = useState<"ar" | "fr" | "en">("ar");
  const cur = d.overrides.find((o) => o.locale === loc);
  const empty = { title: "", subtitle: "", tagline: "", overview: "", short_description: "" };
  const [f, setF] = useState(empty);
  useEffect(() => { setF({ title: cur?.title ?? "", subtitle: cur?.subtitle ?? "", tagline: cur?.tagline ?? "", overview: cur?.overview ?? "", short_description: cur?.short_description ?? "" }); }, [loc, cur?.updated_at]);
  const save = useServerFn(adminSaveOverride);
  const done = useInvalidate(k);
  const m = useMutation({ mutationFn: () => save({ data: { ...ext, locale: loc, fields: f } }), onSuccess: () => { toast.success(`${loc.toUpperCase()} text saved`); done(); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex gap-2">{(["ar", "fr", "en"] as const).map((l) => <button key={l} onClick={() => setLoc(l)} className={cn("rounded-full border px-4 py-1.5 text-sm", loc === l ? "border-gold text-gold" : "border-border text-muted-foreground")}>{l === "ar" ? "العربية" : l === "fr" ? "Français" : "English"}{d.overrides.some((o) => o.locale === l) ? " ●" : ""}</button>)}</div>
      <p className="text-xs text-muted-foreground">Priority: MOROBEST text → provider text in this language → English. Leave a field empty to use provider text. Provider syncs never overwrite this.</p>
      <div dir={loc === "ar" ? "rtl" : "ltr"} className="space-y-3">
        {(["title", "subtitle", "tagline"] as const).map((x) => <label key={x} className="block text-sm capitalize">{x}<input className={cn(field, "mt-1")} value={f[x]} onChange={(e) => setF({ ...f, [x]: e.target.value })} aria-label={x} /></label>)}
        <label className="block text-sm">Overview<textarea className={cn(field, "mt-1 h-40 py-2")} value={f.overview} onChange={(e) => setF({ ...f, overview: e.target.value })} aria-label="Overview" /></label>
        <label className="block text-sm">Short description<textarea className={cn(field, "mt-1 h-20 py-2")} value={f.short_description} onChange={(e) => setF({ ...f, short_description: e.target.value })} aria-label="Short description" /></label>
      </div>
      <button className={mbButton()} disabled={m.isPending} onClick={() => m.mutate()}>Save {loc.toUpperCase()} text</button>
    </div>
  );
}

function Seo({ k, ext, d, currentSlug }: { k: string; ext: Ext; d: D; currentSlug: string }) {
  const s = d.seo;
  const init = () => ({
    slug: s?.slug ?? "", canonical_url: s?.canonical_url ?? "", indexable: s?.indexable ?? true, follow_links: s?.follow_links ?? true,
    seo_title_ar: s?.seo_title_ar ?? "", seo_title_fr: s?.seo_title_fr ?? "", seo_title_en: s?.seo_title_en ?? "",
    meta_description_ar: s?.meta_description_ar ?? "", meta_description_fr: s?.meta_description_fr ?? "", meta_description_en: s?.meta_description_en ?? "",
    og_title: s?.og_title ?? "", og_description: s?.og_description ?? "", og_image: s?.og_image ?? "", schema: s?.schema ? JSON.stringify(s.schema, null, 2) : "",
  });
  const [f, setF] = useState(init);
  useEffect(() => setF(init()), [s?.updated_at]);
  const save = useServerFn(adminSaveSeo);
  const done = useInvalidate(k);
  const n = (v: string) => (v.trim() ? v.trim() : null);
  const m = useMutation({
    mutationFn: () => {
      let schema: Record<string, unknown> | null = null;
      if (f.schema.trim()) { try { schema = JSON.parse(f.schema); } catch { throw new Error("Schema must be valid JSON"); } }
      return save({ data: { ...ext, currentSlug, fields: {
        slug: f.slug === "" ? null : f.slug, canonical_url: n(f.canonical_url), indexable: f.indexable, follow_links: f.follow_links,
        seo_title_ar: n(f.seo_title_ar), seo_title_fr: n(f.seo_title_fr), seo_title_en: n(f.seo_title_en),
        meta_description_ar: n(f.meta_description_ar), meta_description_fr: n(f.meta_description_fr), meta_description_en: n(f.meta_description_en),
        og_title: n(f.og_title), og_description: n(f.og_description), og_image: n(f.og_image), schema,
      } } });
    },
    onSuccess: () => { toast.success("SEO saved"); done(); qc.invalidateQueries({ queryKey: ["editorial", "slug-map"] }); }, onError: (e) => toast.error((e as Error).message, { duration: 9000 }),
  });
  const qc = useQueryClient();
  const slugCheck = validateSlug(f.slug);
  const T = (x: keyof ReturnType<typeof init>, label: string, area = false) => (
    <label className="block text-sm">{label}
      {area ? <textarea className={cn(field, "mt-1 h-20 py-2")} value={f[x] as string} onChange={(e) => setF({ ...f, [x]: e.target.value })} aria-label={label} />
        : <input className={cn(field, "mt-1")} value={f[x] as string} onChange={(e) => setF({ ...f, [x]: e.target.value })} aria-label={label} />}
    </label>
  );
  const base = ext.ct === "series" ? "tv" : ext.ct;
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-xs text-muted-foreground">Empty fields fall back to automatic SEO from provider metadata. Changing the slug keeps a permanent redirect from the old URL.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">Slug <span className="text-muted-foreground">/{base}/…</span><input className={cn(field, "mt-1", !slugCheck.ok && "border-destructive")} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={d.meta?.slug ?? ""} aria-label="Slug" aria-invalid={!slugCheck.ok} aria-describedby="slug-help" />
          {!slugCheck.ok && (
            <span id="slug-help" role="alert" className="mt-1 block text-xs text-destructive">
              {slugCheck.reason}
              {slugCheck.suggestion && <> Suggested: <button type="button" className="font-semibold text-gold underline" onClick={() => setF({ ...f, slug: slugCheck.suggestion! })}>{slugCheck.suggestion}</button></>}
            </span>
          )}
        </label>
        {T("canonical_url", "Canonical URL")}
        {T("seo_title_ar", "SEO title (AR)")}{T("seo_title_fr", "SEO title (FR)")}{T("seo_title_en", "SEO title (EN)")}
        <div className="flex items-end gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.indexable} onChange={(e) => setF({ ...f, indexable: e.target.checked })} className="accent-[var(--gold)]" />Indexable</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.follow_links} onChange={(e) => setF({ ...f, follow_links: e.target.checked })} className="accent-[var(--gold)]" />Follow links</label>
        </div>
        {T("meta_description_ar", "Meta description (AR)", true)}{T("meta_description_fr", "Meta description (FR)", true)}{T("meta_description_en", "Meta description (EN)", true)}
        {T("og_title", "OpenGraph title")}{T("og_description", "OpenGraph description", true)}{T("og_image", "OpenGraph image URL")}
      </div>
      {T("schema", "Custom JSON-LD schema (optional)", true)}
      <button className={mbButton()} disabled={m.isPending} onClick={() => m.mutate()}>Save SEO</button>
    </div>
  );
}

function Episodes({ ext, seasons, linked }: { ext: Ext; seasons: { number: number; name: string; episodeCount: number }[]; linked: boolean }) {
  const first = seasons.find((s) => s.number > 0)?.number ?? 1;
  const [n, setN] = useState(first);
  const qc = useQueryClient();
  const fn = useServerFn(adminEpisodeMapping);
  const setLink = useServerFn(adminSetEpisodeLink);
  const sync = useServerFn(adminSyncEpisodes);
  const q = useQuery({ queryKey: ["admin", "ep-map", ext.pid, n], queryFn: () => fn({ data: { pid: ext.pid, season: n } }), enabled: linked });
  const done = () => { qc.invalidateQueries({ queryKey: ["admin", "ep-map", ext.pid] }); qc.invalidateQueries({ queryKey: ["ep-avail", ext.pid] }); };
  const mSet = useMutation({ mutationFn: (v: { episode: number; episodeId: string | null; reset?: boolean }) => setLink({ data: { pid: ext.pid, season: n, ...v } }), onSuccess: () => { toast.success("Mapping saved"); done(); }, onError: (e) => toast.error((e as Error).message) });
  const mSync = useMutation({ mutationFn: () => sync({ data: { pid: ext.pid } }), onSuccess: (r) => { toast.success(`${r.created} missing episode(s) created`); done(); }, onError: (e) => toast.error((e as Error).message) });
  if (!linked) return <p className="text-muted-foreground">Link this series to a MOROBEST title first (Overview tab).</p>;
  const tag = (e: number) => `S${String(n).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <select className={cn(field, "w-56")} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Season">
          {seasons.map((s) => <option key={s.number} value={s.number}>{s.name} · {s.episodeCount}</option>)}
        </select>
        <button className={mbButton({ variant: "outline", size: "sm" })} disabled={mSync.isPending} onClick={() => mSync.mutate()}>Create missing MOROBEST episodes</button>
        <span className="text-xs text-muted-foreground">Episodes match automatically by season and episode number; pick another to override.</span>
      </div>
      {q.isLoading ? <StarLoader className="py-10" /> : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground"><tr>{["TMDB", "Title", "MOROBEST episode", "Video", ""].map((h) => <th key={h} className="p-3 text-start font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {(q.data?.rows ?? []).map((r) => (
                <tr key={r.number} className="border-t border-border">
                  <td className="p-3 font-mono">{tag(r.number)}</td>
                  <td className="p-3">{r.title}</td>
                  <td className="p-3">
                    <select className={cn(field, "h-8")} value={r.episodeId ?? ""} onChange={(e) => mSet.mutate({ episode: r.number, episodeId: e.target.value || null })} aria-label={`MOROBEST episode for ${tag(r.number)}`}>
                      <option value="">— No MOROBEST episode —</option>
                      {(q.data?.internal ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </td>
                  <td className="p-3">{r.episodeId ? (r.ready ? <Badge tone="green">Video source ready</Badge> : <Badge>No MOROBEST video</Badge>) : <Badge tone="red">Unmapped</Badge>}</td>
                  <td className="p-3">{r.manual && <button className={mbButton({ size: "sm", variant: "ghost" })} onClick={() => mSet.mutate({ episode: r.number, episodeId: null, reset: true })}>Auto</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RamadanTab({ d }: { d: D }) {
  return (
    <div className="space-y-3">
      {d.ramadan.length ? (
        <ul className="space-y-2">{d.ramadan.map((r: any) => <li key={r.id} className="rounded-lg border border-border p-3 text-sm">Ramadan {r.ramadan_seasons?.year} · {r.country_code ?? "no country"} · {r.status}{r.featured ? " · featured" : ""}{r.air_time ? ` · ${r.air_time}` : ""}</li>)}</ul>
      ) : <p className="text-muted-foreground">Not assigned to any Ramadan season.</p>}
      <Link to="/admin-ramadan" className={mbButton({ variant: "outline", size: "sm" })}>Open Ramadan manager</Link>
    </div>
  );
}

function MediaTab({ tab, d }: { tab: "video" | "subtitles" | "audio" | "availability"; d: D }) {
  if (!d.link) return <p className="text-muted-foreground">Link this title to a MOROBEST record first; videos, subtitles and audio belong to the MOROBEST title.</p>;
  const mediaTab = tab === "subtitles" ? "subtitles" : undefined;
  return (
    <div className="space-y-4">
      {tab === "video" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground"><tr>{["Provider", "Status", "Active", "Episode", "Language", "Test"].map((h) => <th key={h} className="p-3 text-start font-normal">{h}</th>)}</tr></thead>
            <tbody>{d.sources.map((s) => <tr key={s.id} className="border-t border-border"><td className="p-3">{s.provider}</td><td className="p-3">{s.status}</td><td className="p-3">{s.is_active ? "yes" : "no"}</td><td className="p-3">{s.episode_id ? "episode" : "whole title"}</td><td className="p-3">{s.language ?? "—"}</td><td className="p-3">{s.is_test_source ? <Badge tone="red">TEST VIDEO</Badge> : ""}</td></tr>)}</tbody>
          </table>
          {d.sources.length === 0 && <p className="p-6 text-muted-foreground">No video sources yet.</p>}
        </div>
      )}
      {tab === "audio" && <p className="text-sm text-muted-foreground">Audio languages come from each video source (language / dubbed flags) and multi-audio HLS tracks.</p>}
      {tab === "availability" && <p className="text-sm text-muted-foreground">Country and date windows are set per video source. Publication status is on the Overview tab.</p>}
      <Link to="/admin-media" search={{ tab: mediaTab, title: d.link.title_id }} className={mbButton()}>Manage in Media / Streaming</Link>
    </div>
  );
}

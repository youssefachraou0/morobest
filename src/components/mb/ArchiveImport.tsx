import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  archiveBulkImport,
  archiveImportItem,
  archiveSearchItems,
} from "@/features/archive/archive.functions";
import { ARCHIVE_COLLECTIONS } from "@/features/archive/collections";
import type { ArchiveImportResult, ArchiveItem } from "@/features/archive/types";
import { mbButton } from "./Button";
import { Badge } from "./Cards";
import { EmptyState } from "./States";
import { cn } from "@/lib/utils";

const field =
  "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
const RIGHTS = "I confirm MOROBEST is authorized to distribute this video.";

const runtime = (s: number | null) =>
  s == null
    ? "—"
    : [Math.floor(s / 3600), Math.floor((s % 3600) / 60)].filter(Boolean).join("h ") +
      ` ${s % 60}m`.trim();
const size = (n: number) =>
  n > 0 ? `${(n / 1_048_576).toFixed(n > 104_857_600 ? 0 : 1)} MB` : "—";

function LicenseBadge({ item }: { item: ArchiveItem }) {
  const open = item.license.status !== "unknown";
  return (
    <span
      className="inline-flex items-center gap-1"
      title={[item.license.label, item.license.url].filter(Boolean).join(" — ")}
    >
      <Badge tone={open ? "green" : "gold"}>
        {open ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
        {item.license.status === "public-domain"
          ? "Public domain"
          : item.license.status === "open"
            ? "Open licence"
            : "Licence unverified"}
      </Badge>
    </span>
  );
}

/**
 * Admin import from archive.org. Search, review the licence each item declares, then import it as
 * a new MOROBEST title or attach it to an existing one. Nothing is imported without an explicit
 * rights confirmation from the signed-in media manager.
 */
export function ArchiveImport({ onImported }: { onImported?: () => void }) {
  const searchFn = useServerFn(archiveSearchItems);
  const importFn = useServerFn(archiveImportItem);
  const bulkFn = useServerFn(archiveBulkImport);

  const [q, setQ] = useState("");
  const [collection, setCollection] = useState("feature_films");
  const [results, setResults] = useState<ArchiveItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [rights, setRights] = useState(false);
  const [ack, setAck] = useState(false);
  const [publish, setPublish] = useState(false);
  const [attachTo, setAttachTo] = useState("");
  const [report, setReport] = useState<ArchiveImportResult[]>([]);

  const titles = useQuery({
    queryKey: ["admin", "archive-attach-titles"],
    enabled: !!expanded,
    queryFn: async () =>
      (
        await supabase
          .from("titles")
          .select("id, slug, original_title, kind, year")
          .is("deleted_at", null)
          .neq("kind", "manga")
          .order("original_title")
          .limit(400)
      ).data ?? [],
  });

  const search = useMutation({
    mutationFn: () => searchFn({ data: { q: q.trim() || undefined, collection, rows: 24 } }),
    onSuccess: (rows) => {
      setResults(rows);
      setExpanded(rows[0]?.identifier ?? null);
      setChecked({});
      if (!rows.length) toast.info("No public-domain items matched that search on archive.org.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const before = useMemo(() => results.map((r) => r.identifier), [results]);

  const runImport = (identifier: string) =>
    importFn({
      data: {
        identifier,
        rightsConfirmed: true,
        acknowledgeUnverifiedLicense: ack || undefined,
        fileName: picked[identifier],
        attachToTitleId: attachTo || undefined,
        publish,
      },
    });

  const one = useMutation({
    mutationFn: (identifier: string) => runImport(identifier),
    onSuccess: (r) => {
      setReport((p) => [r, ...p]);
      if (!r.ok) {
        toast.error(r.reason ?? "Import refused");
        return;
      }
      toast.success(
        `Imported “${r.title}” — ${r.license}. ${r.subtitlesImported ?? 0} subtitle track(s).`,
      );
      setResults((p) => p.filter((x) => x.identifier !== r.identifier));
      onImported?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (ids: string[]) =>
      bulkFn({
        data: {
          identifiers: ids,
          rightsConfirmed: true,
          acknowledgeUnverifiedLicense: ack || undefined,
          publish,
        },
      }),
    onSuccess: ({ results: rows, imported }) => {
      setReport((p) => [...rows, ...p]);
      const failed = rows.filter((r) => !r.ok);
      toast[failed.length ? "warning" : "success"](
        `${imported} imported, ${failed.length} refused.`,
      );
      setChecked({});
      const done = new Set(rows.filter((r) => r.ok).map((r) => r.identifier));
      setResults((p) => p.filter((x) => !done.has(x.identifier)));
      if (imported) onImported?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = Object.keys(checked).filter((k) => checked[k]);
  const item = results.find((r) => r.identifier === expanded) ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className={cn(field, "min-w-[240px] flex-1")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search.mutate()}
            placeholder="Search archive.org — Nosferatu, Sherlock Holmes, Metropolis, public domain…"
            aria-label="Search archive.org"
          />
          <select
            className={cn(field, "w-auto")}
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            aria-label="Collection"
          >
            <option value="">All open collections</option>
            {ARCHIVE_COLLECTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            className={mbButton({ variant: "gold" })}
            onClick={() => search.mutate()}
            disabled={search.isPending}
          >
            {search.isPending ? "Searching archive.org…" : "Search"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Only items archive.org publishes for free reuse are offered here, and each item&apos;s own
          licence statement is shown before import. MOROBEST stores that statement and your
          confirmation next to the video, so every streamed file has an audit trail.
        </p>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-surface-2 p-4">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            <span>{RIGHTS}</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>Licence reviewed for items that declare none</span>
          </label>
          <button
            className={mbButton({ variant: "gold" })}
            disabled={!rights || bulk.isPending}
            onClick={() =>
              bulk.mutate(
                selected
                  .filter((id) => results.find((r) => r.identifier === id)?.video)
                  .slice(0, 25),
              )
            }
          >
            {bulk.isPending ? "Importing…" : "Bulk import as movies"}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => {
            const open = expanded === r.identifier;
            const playable = !!r.video;
            return (
              <li
                key={r.identifier}
                className={cn(
                  "rounded-xl border bg-surface",
                  open ? "border-gold/50" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.title}`}
                    checked={!!checked[r.identifier]}
                    disabled={!playable}
                    onChange={(e) =>
                      setChecked((p) => ({ ...p, [r.identifier]: e.target.checked }))
                    }
                  />
                  <img
                    src={r.posterUrl}
                    alt=""
                    loading="lazy"
                    className="h-16 w-11 rounded object-cover ring-1 ring-border"
                  />
                  <div className="min-w-[220px] flex-1">
                    <p className="font-medium">
                      {r.title}
                      {r.year ? <span className="text-muted-foreground"> · {r.year}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {runtime(r.durationS)} ·{" "}
                      {r.video ? `${r.videoOptions.length} playable file(s)` : "no playable file"} ·{" "}
                      {r.subtitles.length} subtitle track(s)
                      {r.downloads
                        ? ` · ${r.downloads.toLocaleString()} downloads on archive.org`
                        : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <LicenseBadge item={r} />
                      {r.collections.slice(0, 2).map((c) => (
                        <Badge key={c}>{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <a
                    href={r.detailUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold"
                  >
                    Source page <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    className={mbButton({ variant: "ghost" })}
                    onClick={() => setExpanded(open ? null : r.identifier)}
                  >
                    {open ? "Close" : "Review"}
                  </button>
                </div>

                {open && item && (
                  <div className="space-y-4 border-t border-border p-4">
                    {item.description && (
                      <p className="max-h-32 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Licence recorded from archive.org:{" "}
                      <span className="text-foreground/80">{item.license.label}</span>
                      {item.license.url ? (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            className="text-gold hover:underline"
                            href={item.license.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.license.url}
                          </a>
                        </>
                      ) : null}
                      {item.creators.length ? <> · credited: {item.creators.join(", ")}</> : null}
                    </p>

                    {!playable ? (
                      <p className="text-sm text-red-400">
                        This item has no browser-playable file (HLS/MP4/WebM), so it cannot be
                        streamed here.
                      </p>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs">
                            <span className="text-muted-foreground">Video file</span>
                            <select
                              className={field}
                              value={picked[item.identifier] ?? item.video!.name}
                              onChange={(e) =>
                                setPicked((p) => ({ ...p, [item.identifier]: e.target.value }))
                              }
                            >
                              {item.videoOptions.map((f) => (
                                <option key={f.name} value={f.name}>
                                  {f.name} — {f.format} · {size(f.sizeBytes)}
                                  {f.durationS ? ` · ${runtime(f.durationS)}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs">
                            <span className="text-muted-foreground">Add to</span>
                            <select
                              className={field}
                              value={attachTo}
                              onChange={(e) => setAttachTo(e.target.value)}
                            >
                              <option value="">New MOROBEST title (draft)</option>
                              {(titles.data ?? []).map(
                                (t: {
                                  id: string;
                                  original_title: string;
                                  kind: string;
                                  year: number | null;
                                }) => (
                                  <option key={t.id} value={t.id}>
                                    {t.original_title} ({t.kind}
                                    {t.year ? ` ${t.year}` : ""})
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>

                        {item.subtitles.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Subtitles imported automatically:{" "}
                            {item.subtitles
                              .map((s) => `${s.label} (.${s.name.split(".").pop()})`)
                              .join(", ")}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rights}
                              onChange={(e) => setRights(e.target.checked)}
                            />
                            <span>{RIGHTS}</span>
                          </label>
                          {item.license.status === "unknown" && (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={ack}
                                onChange={(e) => setAck(e.target.checked)}
                              />
                              <span>I checked the source page and the licence</span>
                            </label>
                          )}
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={publish}
                              onChange={(e) => setPublish(e.target.checked)}
                            />
                            <span>Publish immediately</span>
                          </label>
                        </div>

                        <button
                          className={mbButton({ variant: "gold" })}
                          disabled={!rights || one.isPending}
                          onClick={() => one.mutate(item.identifier)}
                        >
                          {one.isPending
                            ? "Importing…"
                            : attachTo
                              ? "Attach to title"
                              : "Import as new title"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!results.length && !search.isPending && (
        <EmptyState
          title="Nothing loaded yet"
          body="Search archive.org for public-domain and openly licensed films and series. Imports become normal MOROBEST titles, so the player, subtitles, resume and analytics all work unchanged."
        />
      )}

      {report.length > 0 && (
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4 text-xs">
          <p className="text-sm font-medium">Import log</p>
          {report.slice(0, 20).map((r, i) => (
            <p
              key={`${r.identifier}-${i}`}
              className={r.ok ? "text-foreground/80" : "text-red-400"}
            >
              <span className="font-mono">{r.identifier}</span> —{" "}
              {r.ok
                ? `imported as ${r.slug} (${r.license}${r.subtitlesImported ? `, ${r.subtitlesImported} subs` : ""})`
                : `refused: ${r.reason}`}
              {r.warnings?.length ? (
                <span className="text-muted-foreground"> · {r.warnings.join(" · ")}</span>
              ) : null}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {before.length ? `${before.length} result(s) in this list. ` : ""}
        Imports are limited to 25 items per batch and every one is written to the admin audit log.
      </p>
    </div>
  );
}

// Internet Archive (archive.org) — server-only provider for openly licensed film and TV.
// Reads archive.org's public JSON APIs only (no scraping, no HTML parsing): the scrape/search
// endpoint for discovery, the metadata endpoint for files and license. The license statement
// the item itself carries is always returned to the caller, and every import still records
// which media manager confirmed MOROBEST is allowed to distribute the video.
//
// Metadata and playback only: nothing here decides what is legal, it reports what the item says.

import { ARCHIVE_COLLECTION_IDS } from "./collections";
import type {
  ArchiveItem,
  ArchiveSubtitleFile,
  ArchiveVideoFile,
  IaFile,
  IaMetadata,
  IaRaw,
  LicenseInfo,
} from "./types";

const HOST = "https://archive.org";
const UA = "MOROBEST/1.0 (+https://morobest.com; media-import)";

export type {
  ArchiveItem,
  ArchiveSubtitleFile,
  ArchiveVideoFile,
  IaFile,
  IaMetadata,
  IaRaw,
  LicenseInfo,
  LicenseStatus,
} from "./types";

export class ArchiveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ArchiveError";
  }
}

// ---------------------------------------------------------------- cache

// Search results and item metadata are cached in memory per isolate. archive.org is fast and
// unmetered, so this deliberately stays out of the shared provider_cache table.
const TTL = { search: 30 * 60, item: 6 * 3600 };
const mem = new Map<string, { exp: number; v: unknown }>();

async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const v = await load();
  if (mem.size > 500) mem.clear();
  mem.set(key, { exp: Date.now() + ttlSec * 1000, v });
  return v;
}

async function iaJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${HOST}${path}`;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status === 404) throw new ArchiveError(404, "Item not found on archive.org");
      if (res.status === 429 || res.status >= 500) {
        lastError = `archive.org responded ${res.status}`;
        continue;
      }
      if (!res.ok) throw new ArchiveError(res.status, `archive.org responded ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof ArchiveError && e.status !== 429) throw e;
      lastError = (e as Error).message;
    }
  }
  throw new ArchiveError(0, `archive.org unavailable: ${lastError}`);
}

// ---------------------------------------------------------------- pure helpers

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;

/** archive.org stores arrays, scalars and comma-joined strings in the same field. */
export function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter((x): x is string => !!x);
  const s = str(v);
  return s
    ? s
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
}

export function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function iaDownloadUrl(identifier: string, fileName: string): string {
  const path = fileName.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${HOST}/download/${encodeURIComponent(identifier)}/${path}`;
}

/** Official archive.org thumbnail service; falls back to the site's own placeholder image. */
export const iaImageUrl = (identifier: string) =>
  `${HOST}/services/img/${encodeURIComponent(identifier)}`;
export const iaDetailUrl = (identifier: string) =>
  `${HOST}/details/${encodeURIComponent(identifier)}`;

/** archive.org reports runtime as "1:34:56", "12:04" or raw seconds, sometimes as a number. */
export function parseRuntime(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const s = str(v);
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n > 0 ? Math.round(n) : null;
  }
  const parts = s.split(":").map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const s2 = parts.reduce((a, n) => a * 60 + n, 0);
  return s2 > 0 ? Math.round(s2) : null;
}

/** Accepted spellings (ISO 639-1/2 plus the language's own name) mapped to a display label. */
const LANGS: Record<string, { iso: string; label: string }> = {
  en: { iso: "en", label: "English" },
  eng: { iso: "en", label: "English" },
  english: { iso: "en", label: "English" },
  fr: { iso: "fr", label: "Français" },
  fre: { iso: "fr", label: "Français" },
  fra: { iso: "fr", label: "Français" },
  french: { iso: "fr", label: "Français" },
  francais: { iso: "fr", label: "Français" },
  ar: { iso: "ar", label: "العربية" },
  ara: { iso: "ar", label: "العربية" },
  arabic: { iso: "ar", label: "العربية" },
  es: { iso: "es", label: "Español" },
  spa: { iso: "es", label: "Español" },
  spanish: { iso: "es", label: "Español" },
  espanol: { iso: "es", label: "Español" },
  de: { iso: "de", label: "Deutsch" },
  ger: { iso: "de", label: "Deutsch" },
  deu: { iso: "de", label: "Deutsch" },
  german: { iso: "de", label: "Deutsch" },
  deutsch: { iso: "de", label: "Deutsch" },
  it: { iso: "it", label: "Italiano" },
  ita: { iso: "it", label: "Italiano" },
  italian: { iso: "it", label: "Italiano" },
  pt: { iso: "pt", label: "Português" },
  por: { iso: "pt", label: "Português" },
  portuguese: { iso: "pt", label: "Português" },
  portugues: { iso: "pt", label: "Português" },
  ru: { iso: "ru", label: "Русский" },
  rus: { iso: "ru", label: "Русский" },
  russian: { iso: "ru", label: "Русский" },
  nl: { iso: "nl", label: "Nederlands" },
  dut: { iso: "nl", label: "Nederlands" },
  nld: { iso: "nl", label: "Nederlands" },
  nederlands: { iso: "nl", label: "Nederlands" },
  tr: { iso: "tr", label: "Türkçe" },
  tur: { iso: "tr", label: "Türkçe" },
  trk: { iso: "tr", label: "Türkçe" },
  turkce: { iso: "tr", label: "Türkçe" },
};

/** Best-effort language of a subtitle file, from "movie.en.srt" / "movie_français.vtt". */
export function guessLang(fileName: string): { lang: string; label: string } | null {
  const base = fileName.split("/").pop() ?? fileName;
  const stem = base.replace(/\.(vtt|srt)$/i, "");
  const tokens = stem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[.\-_ ]+/)
    .filter(Boolean)
    .reverse();
  for (const token of tokens.slice(0, 4)) {
    const hit = LANGS[token.replace(/[^a-z]/g, "")];
    if (hit) return { lang: hit.iso, label: hit.label };
  }
  return null;
}

const extOf = (name: string) => (name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase();

// Preference order for browser-playable renditions: HLS for adaptive long-form, then the small
// MPEG4 derivative archive.org generates for every video item, then better MPEG4, then WebM.
function videoRank(file: IaFile): number | null {
  const ext = extOf(file.name ?? "");
  const format = (file.format ?? "").toLowerCase();
  if (ext === "m3u8" || format === "hls") return 0;
  if (ext === "mp4" || ext === "m4v") {
    if (format.includes("512kb")) return 1;
    if (format.includes("mpeg4") || format.includes("h.264") || format.includes("h264")) return 2;
    return 3;
  }
  if (ext === "webm" || format.includes("webm")) return 4;
  // .ogv/.avi/.mkv and everything else are not reliably playable in a browser; ignored.
  return null;
}

const MIN_BYTES = 1_000_000; // skip thumbnails, samples and preview stubs

export function toVideoFile(file: IaFile): ArchiveVideoFile | null {
  const name = str(file.name);
  const rank = name ? videoRank(file) : null;
  if (!name || rank === null) return null;
  const sizeBytes = Number(file.size ?? 0) || 0;
  // HLS manifests are a few kilobytes by nature, so the size floor only guards real media files.
  if (rank !== 0 && sizeBytes && sizeBytes < MIN_BYTES) return null;
  return {
    name,
    format: str(file.format) ?? extOf(name).toUpperCase(),
    sizeBytes,
    durationS: parseRuntime(file.length),
  };
}

/**
 * Every playable rendition, best first. More than one distinct entry means the item holds
 * several video files (multi-part film, multiple cuts, samples) and a human must choose.
 */
export function videoOptions(files: IaFile[]): ArchiveVideoFile[] {
  return files
    .map((f) => ({ file: f, video: toVideoFile(f) }))
    .filter((x): x is { file: IaFile; video: ArchiveVideoFile } => !!x.video)
    .sort((a, b) => {
      const ra = videoRank(a.file) ?? 9;
      const rb = videoRank(b.file) ?? 9;
      if (ra !== rb) return ra - rb;
      return b.video.sizeBytes - a.video.sizeBytes;
    })
    .map((x) => x.video);
}

export function subtitleOptions(files: IaFile[]): ArchiveSubtitleFile[] {
  const out: ArchiveSubtitleFile[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const name = str(f.name);
    if (!name || !/\.(vtt|srt)$/i.test(name)) continue;
    if (name.startsWith(".")) continue;
    const lang = guessLang(name);
    if (!lang) continue;
    const key = `${lang.lang}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      lang: lang.lang,
      label: lang.label,
      caption: `archive.org · ${f.format ?? extOf(name).toUpperCase()}`,
    });
  }
  return out.slice(0, 12);
}

const CC = /creativecommons\.org\/(licenses|publicdomain)/i;
const PD = /(public[\s_-]?domain|mark\/1\.0|zero\/1\.0|cc0)/i;

/**
 * The license the item itself declares. Anything without an explicit statement is "unknown" and
 * must be reviewed by a human before import — MOROBEST never assumes a licence on someone's behalf.
 */
export function licenseOf(meta: IaMetadata): LicenseInfo {
  const url = str(meta.licenseurl);
  const rights = [str(meta.rights), str(meta.license), str(meta.usage)].filter(Boolean).join(" · ");
  if (url && PD.test(url)) return { status: "public-domain", label: "Public domain", url };
  if (url && CC.test(url)) {
    const m = url.match(/licenses\/([a-z-]+)\/([\d.]+)/i);
    const [code, version] = [m?.[1], m?.[2]];
    return {
      status: "open",
      label:
        code && version ? `Creative Commons ${code.toUpperCase()} ${version}` : "Creative Commons",
      url,
    };
  }
  if (PD.test(rights))
    return { status: "public-domain", label: rights.slice(0, 90), url: url ?? null };
  if (CC.test(rights)) return { status: "open", label: rights.slice(0, 90), url: url ?? null };
  if (/public domain/i.test(str(meta.collection) ?? ""))
    return { status: "public-domain", label: "Public-domain collection", url: url ?? null };
  return {
    status: "unknown",
    label: rights ? rights.slice(0, 90) : "No licence statement on the item",
    url: url ?? null,
  };
}

const YEAR = /(1[6-9]\d{2}|20\d{2})/;

export function normalizeItem(identifier: string, raw: IaRaw): ArchiveItem | null {
  if (raw.is_dark) return null; // item withheld from public view
  const meta: IaMetadata = raw.metadata ?? {};
  const files = (raw.files ?? []).filter((f) => typeof f.name === "string");
  const options = videoOptions(files);
  const title = stripHtml(str(meta.title) ?? identifier) || identifier;
  const dateYear = Number((stripHtml(str(meta.date) ?? "").match(YEAR) ?? [])[0]) || null;
  const year = parseRuntime(str(meta.year)) ?? dateYear;
  const description = str(meta.description);
  const runtime =
    parseRuntime(str(meta.runtime)) ?? options.find((o) => o.durationS)?.durationS ?? null;
  return {
    identifier,
    title,
    year: year && year > 1500 && year < 2100 ? year : null,
    description: description ? stripHtml(description).slice(0, 1500) : null,
    creators: asList(meta.creator).slice(0, 5),
    collections: asList(meta.collection).slice(0, 8),
    downloads: Number(str(meta.downloads) ?? "") || null,
    license: licenseOf(meta),
    posterUrl: iaImageUrl(identifier),
    detailUrl: iaDetailUrl(identifier),
    sourceUrl: `${HOST}/metadata/${encodeURIComponent(identifier)}`,
    video: options[0] ?? null,
    videoOptions: options,
    subtitles: subtitleOptions(files),
    durationS: runtime,
  };
}

// ---------------------------------------------------------------- queries

/** Strips Lucene syntax so the admin's text can never break out of its own clause. */
export function sanitizeQuery(q: string): string {
  return q
    .replace(/[\\{}[\]^~:/!()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function searchArchive(input: {
  q?: string;
  collection?: string;
  rows?: number;
}): Promise<ArchiveItem[]> {
  const q = sanitizeQuery(input.q ?? "");
  const collection =
    input.collection && ARCHIVE_COLLECTION_IDS.includes(input.collection) ? input.collection : null;
  if (!q && !collection) return searchArchive({ collection: "feature_films", rows: input.rows });
  const clauses = ["mediatype:(movies)", "NOT collection:(podcasts)", "NOT is_dark:(true)"];
  if (q) clauses.push(`(${q})`);
  if (collection) clauses.push(`collection:(${collection})`);
  const params = new URLSearchParams();
  params.set("q", clauses.join(" AND "));
  for (const f of [
    "identifier",
    "title",
    "year",
    "date",
    "description",
    "licenseurl",
    "rights",
    "creator",
    "collection",
    "downloads",
    "runtime",
  ])
    params.append("fl[]", f);
  params.set("sort[]", "downloads desc");
  params.set("rows", String(Math.min(Math.max(input.rows ?? 24, 1), 50)));
  params.set("page", "1");
  params.set("output", "json");

  const key = `ia:search:${params.toString()}`;
  return cached(key, TTL.search, async () => {
    const json = await iaJson<{ response?: { docs?: IaMetadata[] }; error?: string }>(
      `/advancedsearch.php?${params}`,
    );
    if (json.error) throw new ArchiveError(400, json.error);
    const docs = json.response?.docs ?? [];
    return docs
      .map((d) => {
        const identifier = str(d.identifier);
        return identifier ? normalizeItem(identifier, { metadata: d }) : null;
      })
      .filter((x): x is ArchiveItem => !!x);
  });
}

export async function fetchArchiveItem(identifier: string): Promise<ArchiveItem> {
  const id = identifier.trim();
  if (!/^[A-Za-z0-9._-]{3,120}$/.test(id))
    throw new ArchiveError(400, "Invalid archive.org identifier");
  return cached(`ia:item:${id}`, TTL.item, async () => {
    const raw = await iaJson<IaRaw>(`/metadata/${encodeURIComponent(id)}`);
    const item = normalizeItem(id, raw);
    if (!item) throw new ArchiveError(403, "This item is withheld from public view on archive.org");
    return item;
  });
}

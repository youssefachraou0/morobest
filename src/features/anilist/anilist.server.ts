// AniListProvider — server-only. GraphQL fetch + throttling + retry + two-level cache + normalization.
import type { AniBrowse, AniCard, AniCharacter, AniDetail, AniPage, AniPerson, AniType } from "./types";

const ENDPOINT = "https://graphql.anilist.co";
const mem = new Map<string, { exp: number; v: unknown }>();
let lastCall = 0;
let inflight = new Map<string, Promise<unknown>>();

export const TTL = { trending: 20 * 60, popular: 3 * 3600, detail: 6 * 3600, search: 30 * 60, classic: 24 * 3600 };

async function adminDb() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let attempt = 0;
  for (;;) {
    const wait = lastCall + 350 - Date.now(); // light throttle (AniList allows ~90/min)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const ra = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(ra, 5) * 1000));
      attempt++;
      continue;
    }
    const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
    if (!res.ok || !json?.data) throw new Error(`AniList ${res.status}: ${json?.errors?.[0]?.message ?? "error"}`);
    return json.data;
  }
}

/** Cache-first: memory → database → AniList; on failure serves stale data. */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const m = mem.get(key);
  if (m && m.exp > now) return m.v as T;
  const db = await adminDb();
  let stale: T | undefined = m?.v as T | undefined;
  if (db) {
    const { data } = await db.from("provider_cache").select("payload, expires_at").eq("key", key).maybeSingle();
    if (data) {
      const exp = new Date(data.expires_at).getTime();
      if (exp > now) { mem.set(key, { exp, v: data.payload }); return data.payload as T; }
      stale = data.payload as T;
    }
  }
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      const v = await load();
      const exp = now + ttlSec * 1000;
      mem.set(key, { exp, v });
      if (db) await db.from("provider_cache").upsert({ key, payload: v as never, expires_at: new Date(exp).toISOString(), updated_at: new Date().toISOString() });
      return v;
    } catch (e) {
      console.error("AniList fetch failed", key, e);
      if (stale !== undefined) return stale;
      throw new Error("Anime catalog temporarily unavailable");
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// ---------- Sanitizing & normalization ----------
export function cleanText(html: string | null | undefined): string | null {
  if (!html) return null;
  const t = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t || null;
}
export function slugify(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}
const fmtDate = (d?: { year?: number; month?: number; day?: number } | null) =>
  d?.year ? [d.year, d.month, d.day].filter(Boolean).map((n, i) => (i ? String(n).padStart(2, "0") : n)).join("-") : null;

const CARD = `id type title { romaji english native } description(asHtml: false)
  coverImage { extraLarge large color } bannerImage episodes chapters volumes status format
  seasonYear startDate { year } averageScore popularity genres countryOfOrigin isAdult
  nextAiringEpisode { episode airingAt }`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;
export function toCard(m: Raw): AniCard {
  const title = m.title?.english || m.title?.romaji || m.title?.native || "Untitled";
  return {
    aniListId: m.id, type: m.type, slug: `${slugify(m.title?.romaji || title) || "title"}-${m.id}`,
    title, originalTitle: m.title?.romaji ?? title, nativeTitle: m.title?.native ?? null,
    poster: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null, backdrop: m.bannerImage ?? null,
    color: m.coverImage?.color ?? null, year: m.seasonYear ?? m.startDate?.year ?? null,
    status: m.status ?? null, format: m.format ?? null,
    score: m.averageScore != null ? m.averageScore / 10 : null, popularity: m.popularity ?? 0,
    episodeCount: m.episodes ?? null, chapters: m.chapters ?? null, volumes: m.volumes ?? null,
    genres: m.genres ?? [], country: m.countryOfOrigin ?? null,
    synopsis: cleanText(m.description)?.slice(0, 400) ?? null,
    nextEpisode: m.nextAiringEpisode ?? null,
  };
}
const person = (n: Raw, role: string | null = null): AniPerson => ({
  id: n.id, name: n.name?.full ?? "", native: n.name?.native ?? null, image: n.image?.large ?? null, role,
});

// ---------- Queries ----------
export async function browse(p: AniBrowse, perPage = 24): Promise<AniPage> {
  const q = `query($page:Int,$perPage:Int,$type:MediaType,$sort:[MediaSort],$genre:String,$year:Int,$season:MediaSeason,$format:MediaFormat,$status:MediaStatus,$country:CountryCode,$search:String,$minScore:Int){
    Page(page:$page, perPage:$perPage){ pageInfo{ total currentPage hasNextPage }
      media(type:$type, sort:$sort, genre:$genre, seasonYear:$year, season:$season, format:$format, status:$status, countryOfOrigin:$country, search:$search, averageScore_greater:$minScore, isAdult:false){ ${CARD} } } }`;
  const vars: Record<string, unknown> = {
    page: p.page ?? 1, perPage, type: p.type,
    sort: [p.q ? "SEARCH_MATCH" : p.sort ?? "POPULARITY_DESC"],
    genre: p.genre, year: p.year, season: p.season, format: p.format, status: p.status, country: p.country,
    search: p.q || undefined, minScore: p.minScore,
  };
  const data = await gql<{ Page: Raw }>(q, vars);
  return {
    items: data.Page.media.map(toCard), page: data.Page.pageInfo.currentPage,
    hasNext: data.Page.pageInfo.hasNextPage, total: data.Page.pageInfo.total ?? 0,
  };
}

export async function detail(type: AniType, id: number): Promise<AniDetail | null> {
  const q = `query($id:Int,$type:MediaType){ Media(id:$id, type:$type){ ${CARD} duration season endDate{year month day} startDate{year month day}
    tags{ name rank isMediaSpoiler } meanScore favourites source(version:3) siteUrl
    studios(isMain:true){ nodes{ id name } } trailer{ id site }
    characters(sort:[ROLE, RELEVANCE], perPage:16){ edges{ role node{ id name{full native} image{large} } voiceActors(language:JAPANESE){ id name{full native} image{large} } } }
    staff(perPage:12, sort:RELEVANCE){ edges{ role node{ id name{full native} image{large} } } }
    relations{ edges{ relationType(version:2) node{ ${CARD} } } }
    recommendations(perPage:12, sort:RATING_DESC){ nodes{ mediaRecommendation{ ${CARD} } } }
    externalLinks{ site url type } } }`;
  const data = await gql<{ Media: Raw | null }>(q, { id, type }).catch((e) => {
    if (String(e).includes("404")) return { Media: null };
    throw e;
  });
  const m = data.Media;
  if (!m || m.isAdult) return null;
  const card = toCard(m);
  return {
    ...card,
    synopsis: cleanText(m.description),
    duration: m.duration ?? null, season: m.season ?? null,
    startDate: fmtDate(m.startDate), endDate: fmtDate(m.endDate),
    tags: (m.tags ?? []).filter((t: Raw) => !t.isMediaSpoiler).slice(0, 12).map((t: Raw) => ({ name: t.name, rank: t.rank })),
    meanScore: m.meanScore ?? null, favourites: m.favourites ?? 0, source: m.source ?? null,
    studios: m.studios?.nodes ?? [],
    trailer: m.trailer?.site && m.trailer?.id ? { site: m.trailer.site, id: m.trailer.id } : null,
    characters: (m.characters?.edges ?? []).map((e: Raw): AniCharacter => ({
      ...person(e.node, e.role), voiceActor: e.voiceActors?.[0] ? person(e.voiceActors[0]) : null,
    })),
    staff: (m.staff?.edges ?? []).map((e: Raw) => person(e.node, e.role)),
    relations: (m.relations?.edges ?? []).filter((e: Raw) => e.node && !e.node.isAdult).map((e: Raw) => ({ ...toCard(e.node), relation: e.relationType })),
    recommendations: (m.recommendations?.nodes ?? []).map((n: Raw) => n.mediaRecommendation).filter((x: Raw) => x && !x.isAdult).map(toCard),
    externalLinks: (m.externalLinks ?? []).filter((l: Raw) => /^https:\/\//.test(l.url)).map((l: Raw) => ({ site: l.site, url: l.url })),
    siteUrl: m.siteUrl,
  };
}

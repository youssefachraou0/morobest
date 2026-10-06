// Server-only data access for the public catalog. Imported only inside server function handlers.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ListParams, TitleCard, Translations } from "./types";

export function publicDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Catalog backend is not configured");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
type Db = ReturnType<typeof publicDb>;

export const CARD_SELECT =
  "id, slug, kind, original_title, year, rating, age_rating, status, format, poster_url, backdrop_url, runtime_min, is_kids, popularity, title_translations(locale, title, tagline, synopsis)";

type Row = {
  id: string; slug: string; kind: TitleCard["kind"]; original_title: string; year: number | null; rating: number | null;
  age_rating: number; status: string; format: string | null; poster_url: string | null; backdrop_url: string | null;
  runtime_min: number | null; is_kids: boolean; popularity: number;
  title_translations: { locale: string; title: string; tagline: string | null; synopsis: string | null }[];
};

export function toCard(r: Row): TitleCard {
  const tr: Translations = {};
  for (const t of r.title_translations ?? []) {
    tr[t.locale as keyof Translations] = { title: t.title, tagline: t.tagline, synopsis: t.synopsis };
  }
  return {
    id: r.id, slug: r.slug, kind: r.kind, originalTitle: r.original_title, year: r.year,
    rating: r.rating == null ? null : Number(r.rating), ageRating: r.age_rating, status: r.status, format: r.format,
    poster: r.poster_url, backdrop: r.backdrop_url, runtime: r.runtime_min, isKids: r.is_kids, popularity: r.popularity, tr,
  };
}

async function idsFor(db: Db, table: "title_genres" | "title_countries", column: string, value: string | string[]) {
  const q = db.from(table).select("title_id");
  const { data, error } = Array.isArray(value) ? await q.in(column, value) : await q.eq(column, value);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.title_id as string);
}

function intersect(a: string[] | null, b: string[]) {
  return a == null ? b : a.filter((x) => b.includes(x));
}

export async function listTitles(db: Db, p: ListParams): Promise<TitleCard[]> {
  let restrict: string[] | null = p.ids ?? null;

  if (p.genre) {
    const { data: g } = await db.from("genres").select("id").eq("slug", p.genre).maybeSingle();
    restrict = intersect(restrict, g ? await idsFor(db, "title_genres", "genre_id", g.id) : []);
  }
  if (p.country) {
    const { data: c } = await db.from("countries").select("code").eq("slug", p.country).maybeSingle();
    restrict = intersect(restrict, c ? await idsFor(db, "title_countries", "country_code", c.code) : []);
  }
  if (p.arab) {
    const { data: cs } = await db.from("countries").select("code").eq("is_arab", true);
    restrict = intersect(restrict, await idsFor(db, "title_countries", "country_code", (cs ?? []).map((c) => c.code)));
  }
  if (p.q && p.q.trim()) {
    const term = `%${p.q.trim().replace(/[%_,()]/g, "")}%`;
    const [{ data: a }, { data: b }] = await Promise.all([
      db.from("title_translations").select("title_id").ilike("title", term).limit(200),
      db.from("titles").select("id").ilike("original_title", term).limit(200),
    ]);
    const found = Array.from(new Set([...(a ?? []).map((r) => r.title_id), ...(b ?? []).map((r) => r.id)]));
    restrict = intersect(restrict, found);
  }
  if (restrict && restrict.length === 0) return [];

  let q = db.from("titles").select(CARD_SELECT).eq("published", true).is("deleted_at", null).eq("is_diagnostic", false);
  if (restrict) q = q.in("id", restrict);
  if (p.kind) q = Array.isArray(p.kind) ? q.in("kind", p.kind) : q.eq("kind", p.kind);
  if (p.kids) q = q.eq("is_kids", true);
  if (p.classic) q = q.eq("is_classic", true);
  if (p.status) q = q.eq("status", p.status);
  if (p.format) q = q.eq("format", p.format);
  if (p.year) q = q.eq("year", p.year);
  if (p.maxAge != null) q = q.lte("age_rating", p.maxAge);

  switch (p.sort ?? "popular") {
    case "newest": q = q.order("release_date", { ascending: false, nullsFirst: false }); break;
    case "oldest": q = q.order("release_date", { ascending: true, nullsFirst: false }); break;
    case "rating": q = q.order("rating", { ascending: false, nullsFirst: false }); break;
    case "az": q = q.order("original_title", { ascending: true }); break;
    default: q = q.order("popularity", { ascending: false });
  }
  const { data, error } = await q.limit(Math.min(p.limit ?? 40, 100));
  if (error) {
    console.error("listTitles failed", error);
    throw new Error("Catalog unavailable");
  }
  return (data as unknown as Row[]).map(toCard);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

/** episode_number → MOROBEST episode id for one season: manual episode_links first, then season/episode number match. */
export async function episodeMapFor(db: Db, titleId: string, pid: string, seasonNumber: number): Promise<Record<number, string>> {
  const [{ data: seasons }, { data: links }] = await Promise.all([
    db.from("seasons").select("id, number, episodes(id, number)").eq("title_id", titleId).eq("number", seasonNumber),
    db.from("episode_links").select("episode_number, episode_id").eq("provider", "tmdb").eq("provider_id", pid).eq("season_number", seasonNumber),
  ]);
  const out: Record<number, string> = {};
  for (const s of seasons ?? []) for (const e of (s.episodes ?? []) as { id: string; number: number }[]) out[e.number] = e.id;
  for (const l of links ?? []) {
    if (l.episode_id) out[l.episode_number] = l.episode_id;
    else delete out[l.episode_number];
  }
  return out;
}

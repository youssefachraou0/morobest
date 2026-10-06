import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/features/analytics/track";
import { useAuth } from "@/features/auth/AuthProvider";

/** Watchlist + favorites for the active profile (RLS-scoped). */
export function useLibrary() {
  const { activeProfile } = useAuth();
  const pid = activeProfile?.id;
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["me", "library", pid],
    enabled: !!pid,
    queryFn: async () => {
      const [w, f] = await Promise.all([
        supabase.from("watchlist").select("title_id, created_at").eq("profile_id", pid!).order("created_at", { ascending: false }),
        supabase.from("favorites").select("title_id").eq("profile_id", pid!),
      ]);
      if (w.error) throw w.error;
      return { watchlist: (w.data ?? []).map((r) => r.title_id as string), favorites: (f.data ?? []).map((r) => r.title_id as string) };
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ table, titleId, on }: { table: "watchlist" | "favorites"; titleId: string; on: boolean }) => {
      if (!pid) throw new Error("No profile");
      const res = on
        ? await supabase.from(table).insert({ profile_id: pid, title_id: titleId })
        : await supabase.from(table).delete().eq("profile_id", pid).eq("title_id", titleId);
      if (res.error) throw res.error;
    },
    onSuccess: (_r, v) => { track(`${v.table === "watchlist" ? "watchlist" : "favorite"}_${v.on ? "add" : "remove"}`, { titleId: v.titleId }); return qc.invalidateQueries({ queryKey: ["me", "library", pid] }); },
  });

  return {
    enabled: !!pid,
    watchlist: q.data?.watchlist ?? [],
    favorites: q.data?.favorites ?? [],
    loading: q.isLoading,
    toggle: toggle.mutate,
    pending: toggle.isPending,
  };
}

export type ProgressRow = { title_id: string; episode_id: string | null; position_s: number; duration_s: number; completed: boolean; updated_at: string };

export function useProgress() {
  const { activeProfile } = useAuth();
  const pid = activeProfile?.id;
  return useQuery({
    queryKey: ["me", "progress", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playback_progress")
        .select("title_id, episode_id, position_s, duration_s, completed, updated_at")
        .eq("profile_id", pid!)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ProgressRow[];
    },
  });
}

export async function saveProgress(profileId: string, titleId: string, episodeId: string | null, position: number, duration: number) {
  const completed = duration > 0 && position / duration >= 0.9;
  let q = supabase.from("playback_progress").select("id").eq("profile_id", profileId).eq("title_id", titleId);
  q = episodeId ? q.eq("episode_id", episodeId) : q.is("episode_id", null);
  const { data: existing } = await q.maybeSingle();
  const now = new Date().toISOString();
  const row = { position_s: Math.floor(position), duration_s: Math.floor(duration), completed, updated_at: now, last_watched_at: now };
  const res = existing
    ? await supabase.from("playback_progress").update(row).eq("id", existing.id)
    : await supabase.from("playback_progress").insert({ ...row, profile_id: profileId, title_id: titleId, episode_id: episodeId });
  if (res.error) console.error("progress save failed", res.error);
}

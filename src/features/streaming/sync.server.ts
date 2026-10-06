import type { SupabaseClient } from "@supabase/supabase-js";
import { providerFor } from "./providers.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncSource(db: SupabaseClient<any>, sourceId: string) {
  const { data: s, error } = await db.from("video_sources").select("id, provider, upload_id, provider_asset_id, status, replaces_source_ids").eq("id", sourceId).single();
  if (error || !s) throw new Error("Source not found");
  const p = providerFor(s.provider ?? "url");
  if (!p.status) return { status: s.status as string };
  try {
    const st = await p.status(s);
    const patch: Record<string, unknown> = { status: st.status, error_message: st.error ?? null };
    if (st.assetId) patch.provider_asset_id = st.assetId;
    if (st.playbackId) patch.playback_id = st.playbackId;
    if (st.duration) patch.duration_s = st.duration;
    if (st.status === "ready" && s.status !== "ready") patch.is_active = true;
    await db.from("video_sources").update(patch).eq("id", sourceId);
    // "Replace" uploads retire the previous production sources only once the new one is playable.
    if (st.status === "ready" && s.replaces_source_ids?.length)
      await db.from("video_sources").update({ is_active: false, status: "disabled" }).in("id", s.replaces_source_ids).neq("id", sourceId);
    return { status: st.status, error: st.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provider error";
    await db.from("video_sources").update({ error_message: msg.slice(0, 300) }).eq("id", sourceId);
    return { status: s.status as string, error: msg };
  }
}

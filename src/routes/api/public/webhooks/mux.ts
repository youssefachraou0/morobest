import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Mux webhook: verifies mux-signature (HMAC-SHA256 over "t.body", 5 min tolerance),
// applies the status carried by the event, then re-syncs the source from the Mux API.
async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const Event = z.object({
  type: z.string().max(100),
  data: z.object({
    id: z.string().max(200).optional(),
    upload_id: z.string().max(200).optional(),
    asset_id: z.string().max(200).optional(),
    playback_ids: z.array(z.object({ id: z.string().max(200) })).optional(),
    errors: z.object({ messages: z.array(z.string()).optional() }).optional(),
    error: z.object({ message: z.string().optional() }).optional(),
  }).passthrough().optional(),
}).passthrough();

const STATUS: Record<string, "processing" | "ready" | "failed"> = {
  "video.upload.asset_created": "processing",
  "video.asset.created": "processing",
  "video.asset.ready": "ready",
  "video.asset.errored": "failed",
  "video.upload.errored": "failed",
  "video.upload.cancelled": "failed",
};

export const Route = createFileRoute("/api/public/webhooks/mux")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MUX_WEBHOOK_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });
        const header = request.headers.get("mux-signature") ?? "";
        let t = ""; const v1: string[] = [];
        for (const p of header.split(",")) {
          const [k, v] = p.split("=");
          if (k === "t") t = v ?? ""; else if (k === "v1" && v) v1.push(v);
        }
        const body = await request.text();
        if (!t || !v1.length || !Number.isFinite(Number(t)) || Math.abs(Date.now() / 1000 - Number(t)) > 300) return new Response("Bad signature", { status: 401 });
        const expected = await hmacHex(secret, `${t}.${body}`);
        if (!v1.some((s) => safeEq(expected, s))) return new Response("Bad signature", { status: 401 });

        let parsed;
        try { parsed = Event.safeParse(JSON.parse(body)); } catch { return new Response("Bad payload", { status: 400 }); }
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const evt = parsed.data;
        const status = STATUS[evt.type];
        if (!status) return new Response("ignored");

        const isUpload = evt.type.startsWith("video.upload.");
        const uploadId = isUpload ? evt.data?.id : evt.data?.upload_id;
        const assetId = isUpload ? evt.data?.asset_id : evt.data?.id;
        if (!uploadId && !assetId) return new Response("ignored");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncSource } = await import("@/features/streaming/sync.server");
        const filters = [uploadId && `upload_id.eq.${uploadId}`, assetId && `provider_asset_id.eq.${assetId}`].filter(Boolean).join(",");
        const { data: rows } = await supabaseAdmin.from("video_sources").select("id, status").eq("provider", "mux").or(filters).limit(5);

        for (const r of rows ?? []) {
          if (r.status === "disabled") continue;
          const patch: Record<string, unknown> = { status };
          if (assetId) patch.provider_asset_id = assetId;
          const pb = evt.data?.playback_ids?.[0]?.id;
          if (pb) patch.playback_id = pb;
          if (status === "failed") patch.error_message = (evt.data?.errors?.messages?.join("; ") || evt.data?.error?.message || evt.type).slice(0, 300);
          if (status === "ready") { patch.error_message = null; if (r.status !== "ready") patch.is_active = true; }
          await supabaseAdmin.from("video_sources").update(patch).eq("id", r.id);
          if (status !== "failed") { try { await syncSource(supabaseAdmin, r.id); } catch { /* event status already applied */ } }
        }
        return Response.json({ ok: true, updated: rows?.length ?? 0 });
      },
    },
  },
});

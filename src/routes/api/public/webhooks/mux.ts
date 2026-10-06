import { createFileRoute } from "@tanstack/react-router";

// Mux webhook: verifies the mux-signature header (HMAC-SHA256 over "t.body"), then syncs the matching source.
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

export const Route = createFileRoute("/api/public/webhooks/mux")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MUX_WEBHOOK_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });
        const header = request.headers.get("mux-signature") ?? "";
        const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
        const body = await request.text();
        if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return new Response("Bad signature", { status: 401 });
        if (!safeEq(await hmacHex(secret, `${parts.t}.${body}`), parts.v1)) return new Response("Bad signature", { status: 401 });

        const evt = JSON.parse(body) as { type?: string; data?: { id?: string; upload_id?: string } };
        if (!evt.type?.startsWith("video.asset.") && !evt.type?.startsWith("video.upload.")) return new Response("ignored");
        const uploadId = evt.type.startsWith("video.upload.") ? evt.data?.id : evt.data?.upload_id;
        const assetId = evt.type.startsWith("video.asset.") ? evt.data?.id : undefined;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncSource } = await import("@/features/streaming/sync.server");
        let q = supabaseAdmin.from("video_sources").select("id").eq("provider", "mux");
        q = uploadId ? q.eq("upload_id", uploadId) : q.eq("provider_asset_id", assetId ?? "-");
        const { data: rows } = await q.limit(5);
        for (const r of rows ?? []) await syncSource(supabaseAdmin, r.id);
        return new Response("ok");
      },
    },
  },
});

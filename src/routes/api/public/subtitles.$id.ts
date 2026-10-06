import { createFileRoute } from "@tanstack/react-router";

// Serves active subtitle tracks as WebVTT. Public by design: only active tracks are returned, no private data.
export const Route = createFileRoute("/api/public/subtitles/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
        const { publicDb } = await import("@/features/catalog/catalog.server");
        const { data } = await publicDb().rpc("subtitle_vtt", { _id: params.id });
        if (!data) return new Response("Not found", { status: 404 });
        return new Response(data as string, {
          headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
        });
      },
    },
  },
});

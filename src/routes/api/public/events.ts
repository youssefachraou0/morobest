import { createFileRoute } from "@tanstack/react-router";
import { BatchSchema, botName, hashVisitor, isBot, isTestBatch, toRows } from "@/features/analytics/schema";

/**
 * First-party analytics ingestion. Public by design (anonymous visitors send events), so it accepts only the
 * strict schema in features/analytics/schema.ts, stores a hashed visitor id (no IP), marks QA/test traffic,
 * and diverts crawler traffic to a separate SEO counter.
 */
export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 64_000) return new Response("too large", { status: 413 });
        let parsed;
        try { parsed = BatchSchema.parse(JSON.parse(raw)); } catch { return new Response("bad request", { status: 400 }); }
        const ua = request.headers.get("user-agent") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const test = isTestBatch(parsed);

        // Automated tests flag themselves as QA and are stored as test traffic; other headless/bot UAs are crawlers.
        if (!test && isBot(ua)) {
          const day = new Date().toISOString().slice(0, 10);
          const bot = botName(ua);
          const sections = new Map<string, number>();
          for (const p of parsed.events) if (p.e === "page_view") { const sec = p.path.split("/")[1] || "home"; sections.set(sec, (sections.get(sec) ?? 0) + 1); }
          for (const [section, n] of sections) {
            const { data: cur } = await supabaseAdmin.from("crawler_hits").select("hits").match({ day, bot, section }).maybeSingle();
            await supabaseAdmin.from("crawler_hits").upsert({ day, bot, section, hits: (cur?.hits ?? 0) + n });
          }
          return new Response(null, { status: 204 });
        }

        const rows = toRows(parsed, await hashVisitor(parsed.v), Date.now());
        const { error } = await supabaseAdmin.from("analytics_events").insert(rows);
        if (error) console.error("analytics insert failed", error.message);
        // Opportunistic retention: ~1 in 100 batches asks the DB, which itself only runs at most every 6 hours.
        if (Math.random() < 0.01) await supabaseAdmin.rpc("analytics_maintain_if_due").then(({ error: e }) => e && console.error("analytics maintain", e.message));
        return new Response(null, { status: 204 });
      },
    },
  },
});

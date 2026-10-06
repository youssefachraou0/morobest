import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { providerConfig, testMux } from "@/features/streaming/streaming.functions";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader, EmptyState } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";
import { Badge } from "@/components/mb/Cards";
import { mbButton } from "@/components/mb/Button";

export const Route = createFileRoute("/_authenticated/admin-settings")({
  head: () => ({ meta: [{ title: "Streaming providers · MOROBEST Admin" }, { name: "description", content: "Configure MOROBEST streaming providers." }, { name: "robots", content: "noindex" }] }),
  component: Settings,
});

const MUX_FIELDS: [string, string, boolean][] = [
  ["MUX_TOKEN_ID", "Access token ID", true],
  ["MUX_TOKEN_SECRET", "Access token secret", true],
  ["MUX_SIGNING_KEY_ID", "Signing key ID (private playback)", false],
  ["MUX_SIGNING_PRIVATE_KEY", "Signing private key, base64 (private playback)", false],
  ["MUX_WEBHOOK_SECRET", "Webhook signing secret (instant status updates)", false],
];

function Settings() {
  const { canManageMedia, ready, rolesReady } = useAuth();
  const cfgFn = useServerFn(providerConfig);
  const testFn = useServerFn(testMux);
  const cfg = useQuery({ queryKey: ["admin", "providers"], enabled: canManageMedia, queryFn: () => cfgFn() });
  const [test, setTest] = useState<"not_configured" | "connected" | "failed" | "pending" | null>(null);

  if (!ready || !rolesReady) return <StarLoader className="min-h-screen" />;
  if (!canManageMedia) return <div className="pt-32"><EmptyState title="Media managers only" body="Your account does not have access to streaming settings." /></div>;

  const muxOn = cfg.data?.mux;
  const set: Record<string, boolean | undefined> = {
    MUX_TOKEN_ID: muxOn, MUX_TOKEN_SECRET: muxOn, MUX_SIGNING_KEY_ID: cfg.data?.muxSigned, MUX_SIGNING_PRIVATE_KEY: cfg.data?.muxSigned, MUX_WEBHOOK_SECRET: cfg.data?.muxWebhook,
  };
  const status = test === "pending" ? null : test ?? (muxOn ? null : "not_configured");

  return (
    <div className="pb-16">
      <PageHeader eyebrow="Admin · Settings" title="Streaming providers" subtitle="Credentials are stored as encrypted server secrets — never in the database, the browser or logs.">
        <Link to="/admin" className="mt-4 inline-block text-sm text-muted-foreground hover:text-gold">← Back to dashboard</Link>
      </PageHeader>
      <div className="grid gap-6 px-4 sm:px-8 lg:grid-cols-2 lg:px-14">
        <section className="rounded-xl border border-gold/40 bg-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Mux <span className="text-sm text-gold">Primary</span></h2>
            {status === "connected" ? <Badge tone="green">Connected</Badge> : status === "failed" ? <Badge tone="red">Connection failed</Badge> : status === "not_configured" ? <Badge>Not configured</Badge> : <Badge tone="gold">Configured</Badge>}
          </div>
          {!muxOn && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">Mux production credentials not configured. Uploads are disabled; development test playback keeps working.</p>}
          <ul className="mt-4 space-y-2 text-sm">
            {MUX_FIELDS.map(([k, label, req]) => (
              <li key={k} className="flex items-center justify-between gap-3 border-b border-border/60 py-2">
                <span><code className="text-xs text-gold">{k}</code><span className="block text-muted-foreground">{label}{req ? "" : " · optional"}</span></span>
                <Badge tone={set[k] ? "green" : "default"}>{set[k] ? "Saved" : "Not set"}</Badge>
              </li>
            ))}
          </ul>
          <button onClick={async () => { setTest("pending"); try { setTest((await testFn()).status); } catch { setTest("failed"); } }} disabled={test === "pending"} className={mbButton({ variant: "outline", className: "mt-5" })}>
            {test === "pending" ? "Testing…" : "Test connection"}
          </button>
        </section>
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Cloudflare Stream <span className="text-sm text-muted-foreground">Optional fallback</span></h2>
            <Badge tone={cfg.data?.cloudflare ? "green" : "default"}>{cfg.data?.cloudflare ? "Configured" : "Not configured"}</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Not required. Add CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN and CLOUDFLARE_STREAM_CUSTOMER_CODE later to enable it as a secondary provider.</p>
        </section>
      </div>
    </div>
  );
}

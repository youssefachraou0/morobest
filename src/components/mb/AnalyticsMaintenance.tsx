import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminPurgeTestAnalytics, adminRunAnalyticsCleanup } from "@/features/analytics/analytics.functions";
import { useAuth } from "@/features/auth/AuthProvider";
import { mbButton } from "./Button";

/** Admin-only maintenance: retention cleanup on demand and removal of QA/test traffic. Server re-checks the role. */
export function MaintenanceBar({ testEvents, onDone }: { testEvents: number; onDone: () => void }) {
  const { isAdmin } = useAuth();
  const cleanup = useServerFn(adminRunAnalyticsCleanup);
  const purge = useServerFn(adminPurgeTestAnalytics);
  const [busy, setBusy] = useState<string | null>(null);
  if (!isAdmin) return null;
  const run = async (k: string, f: () => Promise<string>) => {
    setBusy(k);
    try { toast.success(await f()); onDone(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
      <span className="text-muted-foreground">Retention: raw events 90 days · playback error log 180 days · daily totals kept long-term.</span>
      <button className={mbButton({ size: "sm", variant: "glass" })} disabled={!!busy} onClick={() => run("c", async () => { const r = await cleanup(); return `Cleanup done — ${r.raw_deleted} old events removed.`; })}>
        {busy === "c" ? "Running…" : "Run Analytics Cleanup"}
      </button>
      <button className={mbButton({ size: "sm", variant: "glass" })} disabled={!!busy || testEvents === 0} onClick={() => run("p", async () => { const r = await purge(); return `${r.deleted} test events deleted.`; })}>
        {busy === "p" ? "Deleting…" : `Delete test traffic (${testEvents} in range)`}
      </button>
    </div>
  );
}

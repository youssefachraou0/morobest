import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAuditLog } from "@/features/editorial/admin.functions";
import { StarLoader } from "./Brand";
import { Badge } from "./Cards";

export const field = "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm focus:border-gold focus:outline-none";
export const keyOf = (ct: string, pid: number | string) => `${ct}-${pid}`;

export function AuditTable({ contentId }: { contentId?: string }) {
  const fn = useServerFn(adminAuditLog);
  const q = useQuery({ queryKey: ["admin", "audit", contentId ?? "all"], queryFn: () => fn({ data: { contentId } }) });
  if (q.isLoading) return <StarLoader className="py-10" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-muted-foreground"><tr>{["When", "Action", "Content", "Admin", "Change"].map((h) => <th key={h} className="p-3 text-start font-normal">{h}</th>)}</tr></thead>
        <tbody>
          {(q.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-3"><Badge>{r.action}</Badge></td>
              <td className="p-3 font-mono text-xs">{r.content_id}</td>
              <td className="p-3 font-mono text-xs">{r.admin_id.slice(0, 8)}</td>
              <td className="max-w-md p-3 font-mono text-[11px] text-muted-foreground"><span className="line-clamp-3 break-all">{r.old_value ? `${JSON.stringify(r.old_value)} → ` : ""}{JSON.stringify(r.new_value)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {q.data?.length === 0 && <p className="p-6 text-muted-foreground">No admin activity recorded yet.</p>}
    </div>
  );
}

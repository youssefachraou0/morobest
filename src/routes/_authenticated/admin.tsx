import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader, EmptyState } from "@/components/mb/States";
import { StarLoader } from "@/components/mb/Brand";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · MOROBEST" }, { name: "description", content: "MOROBEST administration." }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const SECTIONS = ["Dashboard", "Movies", "Series", "Anime", "Manga", "Ramadan", "Kids", "People", "Genres", "Countries", "Collections", "Media", "Subtitles", "Users", "Homepage", "SEO", "Analytics", "Security", "Settings", "Integrations"];

function Admin() {
  const { isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["me", "roles"], queryFn: async () => (await supabase.from("user_roles").select("role")).data ?? [] });

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const count = async (table: "titles" | "episodes" | "people" | "collections" | "manga_chapters") =>
        (await supabase.from(table).select("*", { count: "exact", head: true })).count ?? 0;
      const [titles, episodes, people, collections, chapters] = await Promise.all([count("titles"), count("episodes"), count("people"), count("collections"), count("manga_chapters")]);
      return { titles, episodes, people, collections, chapters };
    },
  });
  const list = useQuery({
    queryKey: ["admin", "titles"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("titles").select("id, slug, kind, original_title, year, published, popularity").order("updated_at", { ascending: false }).limit(100)).data ?? [],
  });
  const togglePub = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase.from("titles").update({ published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "titles"] }),
    onError: () => toast.error("Update failed"),
  });

  if (!ready || roles.isLoading) return <StarLoader className="min-h-screen" />;
  if (!isAdmin) return <div className="pt-32"><EmptyState title="Admins only" body="Your account does not have access to the admin area." /></div>;

  return (
    <div className="flex">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto border-e border-border p-4 pt-20 lg:block">
        {SECTIONS.map((s, i) => (
          <p key={s} className={i === 0 || s === "Movies" ? "rounded-md bg-surface-2 px-3 py-2 text-sm text-gold" : "px-3 py-2 text-sm text-muted-foreground"}>{s}</p>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <PageHeader eyebrow="Admin" title="Dashboard" />
        <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-5 sm:px-8">
          {Object.entries(stats.data ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-surface p-4">
              <p className="eyebrow">{k}</p>
              <p className="mt-2 font-display text-4xl">{v}</p>
            </div>
          ))}
        </div>
        <div className="px-4 py-8 sm:px-8">
          <h2 className="mb-4 font-display text-2xl">Catalog</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-start text-muted-foreground">
                <tr><th className="p-3 text-start">Title</th><th className="p-3 text-start">Kind</th><th className="p-3 text-start">Year</th><th className="p-3 text-start">Popularity</th><th className="p-3 text-start">Published</th></tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3"><Link to="/title/$slug" params={{ slug: r.slug }} className="hover:text-gold">{r.original_title}</Link></td>
                    <td className="p-3">{r.kind}</td>
                    <td className="p-3">{r.year}</td>
                    <td className="p-3">{r.popularity}</td>
                    <td className="p-3">
                      <input type="checkbox" checked={r.published} onChange={(e) => togglePub.mutate({ id: r.id, published: e.target.checked })} aria-label="Published" className="accent-[var(--gold)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

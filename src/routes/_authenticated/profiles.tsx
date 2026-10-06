import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { MbButton } from "@/components/mb/Button";
import { Star8 } from "@/components/mb/Brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profiles")({
  head: () => ({ meta: [{ title: "Profiles · MOROBEST" }, { name: "description", content: "Choose who is watching." }, { name: "robots", content: "noindex" }] }),
  component: Profiles,
});

function Profiles() {
  const { t } = useI18n();
  const { user, profiles, activeProfile, setActiveProfile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kids, setKids] = useState(false);
  const [age, setAge] = useState(9);

  const refresh = () => qc.invalidateQueries({ queryKey: ["me", "profiles"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const { error } = await supabase.from("profiles").insert({ user_id: user.id, display_name: name.trim().slice(0, 40), is_kids: kids, max_age: kids ? age : 18 });
    if (error) return toast.error(t.error.generic);
    setAdding(false); setName(""); setKids(false);
    refresh();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return toast.error(t.error.generic);
    refresh();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-28">
      <h1 className="font-display text-5xl">{t.auth.whoWatching}</h1>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        {profiles.map((p) => (
          <div key={p.id} className="group relative">
            <button
              onClick={() => { setActiveProfile(p.id); navigate({ to: "/" }); }}
              className={cn("flex w-32 flex-col items-center gap-3 rounded-xl p-2 transition", activeProfile?.id === p.id && "ring-2 ring-gold")}
            >
              <span className="flex h-28 w-28 items-center justify-center rounded-xl bg-emerald pattern-zellige font-display text-5xl text-gold ring-1 ring-gold/40 transition group-hover:ring-gold">
                {p.is_kids ? <Star8 className="h-14 w-14" /> : p.display_name[0]?.toUpperCase()}
              </span>
              <span className="text-sm">{p.display_name}</span>
              {p.is_kids && <span className="text-xs text-gold">{t.label.kidsProfile} · {p.max_age}+</span>}
            </button>
            {profiles.length > 1 && (
              <button onClick={() => remove(p.id)} aria-label="Delete profile" className="absolute end-1 top-1 hidden rounded-full bg-background/80 p-1.5 text-muted-foreground hover:text-destructive group-hover:block">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {profiles.length < 6 && !adding && (
          <button onClick={() => setAdding(true)} className="flex w-32 flex-col items-center gap-3 p-2 text-muted-foreground hover:text-gold">
            <span className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-border"><Plus className="h-8 w-8" /></span>
            <span className="text-sm">{t.auth.addProfile}</span>
          </button>
        )}
      </div>
      {adding && (
        <form onSubmit={add} className="mt-10 w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-6">
          <input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.auth.profileName} aria-label={t.auth.profileName}
            className="h-11 w-full rounded-lg border border-input bg-background px-4 focus:border-gold focus:outline-none" />
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} className="accent-[var(--gold)]" />{t.label.kidsProfile}</label>
          {kids && (
            <label className="flex items-center justify-between text-sm">{t.label.age}
              <select value={age} onChange={(e) => setAge(Number(e.target.value))} className="rounded-md border border-input bg-background px-2 py-1">
                {[0, 6, 9, 12].map((a) => <option key={a} value={a}>{a === 0 ? "Preschool" : `${a}+`}</option>)}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <MbButton type="submit" className="flex-1">{t.action.add}</MbButton>
            <MbButton type="button" variant="ghost" onClick={() => setAdding(false)}>{t.action.cancel}</MbButton>
          </div>
        </form>
      )}
    </div>
  );
}

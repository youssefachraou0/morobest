import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { MbButton } from "@/components/mb/Button";
import { Logo } from "@/components/mb/Brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/auth")({
  head: () => seo("Sign in", "Sign in or create your MOROBEST account."),
  component: AuthPage,
});

const field = "h-12 w-full rounded-lg border border-input bg-surface px-4 focus:border-gold focus:outline-none";

function AuthPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/profiles" }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) toast(t.auth.checkEmail);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast(t.auth.resetSent);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.error.generic);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(t.error.generic);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-24">
      <img src="/images/backdrops/b1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-hero-fade" />
      <div className="relative w-full max-w-md rounded-2xl border border-gold/20 bg-background/85 p-8 backdrop-blur-xl">
        <div className="absolute inset-0 rounded-2xl pattern-zellige opacity-[0.04]" aria-hidden />
        <div className="relative">
          <Logo />
          <h1 className="mt-6 font-display text-3xl">{mode === "up" ? t.action.signUp : mode === "reset" ? t.auth.forgot : t.auth.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.auth.subtitle}</p>
          {mode !== "reset" && (
            <>
              <MbButton type="button" variant="glass" className="mt-6 w-full" onClick={google}>{t.auth.google}</MbButton>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t.auth.or}<span className="h-px flex-1 bg-border" /></div>
            </>
          )}
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required autoComplete="email" placeholder={t.auth.email} aria-label={t.auth.email} value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            {mode !== "reset" && (
              <input type="password" required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder={t.auth.password} aria-label={t.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            )}
            <MbButton type="submit" disabled={busy} className="w-full" size="lg">
              {mode === "up" ? t.action.signUp : mode === "reset" ? t.action.save : t.action.signIn}
            </MbButton>
          </form>
          <div className="mt-5 flex justify-between text-sm text-muted-foreground">
            <button onClick={() => setMode(mode === "up" ? "in" : "up")} className="hover:text-gold">
              {mode === "up" ? `${t.auth.haveAccount} ${t.action.signIn}` : `${t.auth.noAccount} ${t.action.signUp}`}
            </button>
            {mode === "in" && <button onClick={() => setMode("reset")} className="hover:text-gold">{t.auth.forgot}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

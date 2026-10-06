import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { MbButton } from "@/components/mb/Button";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  head: () => seo("Reset password", "Choose a new password for your MOROBEST account."),
  component: Reset,
});

function Reset() {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    navigate({ to: "/" });
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-8">
        <h1 className="font-display text-3xl">{t.auth.newPassword}</h1>
        <input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} aria-label={t.auth.newPassword}
          className="h-12 w-full rounded-lg border border-input bg-background px-4 focus:border-gold focus:outline-none" />
        <MbButton type="submit" className="w-full">{t.auth.updatePassword}</MbButton>
      </form>
    </div>
  );
}

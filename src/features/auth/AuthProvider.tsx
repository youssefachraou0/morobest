import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string; display_name: string; avatar: string; is_kids: boolean; max_age: number; locale: string;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfile: (id: string) => void;
  isAdmin: boolean;
  maxAge: number | undefined;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Ctx | null>(null);
const ACTIVE_KEY = "mb_active_profile";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    setActiveId(localStorage.getItem(ACTIVE_KEY));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event === "SIGNED_OUT") qc.removeQueries({ queryKey: ["me"] });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc, router]);

  const user = session?.user ?? null;

  const profilesQ = useQuery({
    queryKey: ["me", "profiles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name, avatar, is_kids, max_age, locale").order("created_at");
      if (error) throw error;
      if (data.length === 0) {
        const name = (user!.user_metadata?.full_name as string) || user!.email?.split("@")[0] || "Me";
        const { data: created, error: e2 } = await supabase
          .from("profiles").insert({ user_id: user!.id, display_name: name }).select("id, display_name, avatar, is_kids, max_age, locale");
        if (e2) throw e2;
        return created as Profile[];
      }
      return data as Profile[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["me", "roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      return (data ?? []).map((r) => r.role);
    },
  });

  const profiles = profilesQ.data ?? [];
  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;

  const value: Ctx = {
    user, ready, profiles, activeProfile,
    setActiveProfile: (id) => {
      localStorage.setItem(ACTIVE_KEY, id);
      setActiveId(id);
    },
    isAdmin: (rolesQ.data ?? []).includes("admin"),
    maxAge: activeProfile?.is_kids ? activeProfile.max_age : undefined,
    signOut: async () => {
      localStorage.removeItem(ACTIVE_KEY);
      await supabase.auth.signOut();
      qc.removeQueries({ queryKey: ["me"] });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

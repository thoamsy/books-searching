import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { batchUpsertBookmarks } from "@/lib/supabase-api";
import { readLocalBookmarks, clearLocalBookmarks } from "@/lib/bookmark-store";

interface AuthState {
  enabled: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithOAuth: (provider: "google" | "github") => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const user = session?.user ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;

    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    // PWA / mobile: browser suspends timers when backgrounded, so the
    // automatic token refresh never fires and the session silently expires.
    // Restart the refresh loop every time the app comes back to foreground.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Migrate localStorage bookmarks to cloud on login
  useEffect(() => {
    if (!supabase) return;

    const userId = session?.user?.id;
    if (!userId) return;

    const localBookmarks = readLocalBookmarks();
    if (localBookmarks.length === 0) return;

    batchUpsertBookmarks(userId, localBookmarks)
      .then(() => {
        clearLocalBookmarks();
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      })
      .catch((err) => console.error("[bookmark migration] failed:", err));
  }, [session?.user?.id, queryClient]);

  async function signInWithOAuth(provider: "google" | "github") {
    if (!supabase) {
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) {
      return { error: "当前站点未配置登录服务。" };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabase) {
      return { error: "当前站点未配置登录服务。" };
    }

    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  return (
    <AuthContext value={{ enabled: isSupabaseConfigured, user, session, loading, signInWithOAuth, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

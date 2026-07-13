import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";
import { applyInterfaceMode, type InterfaceMode } from "./personal-settings";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export type OAuthProvider = "github" | "google";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }

    let active = true;

    void client.auth
      .getSession()
      .then(async ({ data }: { data: { session: Session | null } }) => {
        if (!active) return;
        if (data.session) {
          const { data: profile } = await client
            .from("profiles")
            .select("interface_mode")
            .eq("id", data.session.user.id)
            .maybeSingle();
          if (!active) return;
          const mode = profile?.interface_mode;
          applyInterfaceMode(
            mode === "light" || mode === "dark" ? mode : "system",
          );
        } else {
          const stored = window.localStorage.getItem("sf-interface-mode");
          applyInterfaceMode(
            stored === "light" || stored === "dark" ? stored : "system",
          );
        }
        setSession(data.session);
        setLoading(false);
      });

    const { data } = client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        const stored = window.localStorage.getItem("sf-interface-mode");
        applyInterfaceMode(
          (stored === "light" || stored === "dark"
            ? stored
            : "system") as InterfaceMode,
        );
        setSession(nextSession);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      async signIn(email, password) {
        if (!client) throw getSupabaseConfigError();
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      },
      async signUp(fullName, email, password) {
        if (!client) throw getSupabaseConfigError();
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        return { needsEmailConfirmation: !data.session };
      },
      async signInWithProvider(provider) {
        if (!client) throw getSupabaseConfigError();
        const { error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
      },
      async requestPasswordReset(email) {
        if (!client) throw getSupabaseConfigError();
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        if (!client) throw getSupabaseConfigError();
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
      },
      async signOut() {
        if (!client) throw getSupabaseConfigError();
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
    }),
    [client, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

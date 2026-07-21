import type { Session } from "@supabase/supabase-js";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/lib/auth";
import { applyInterfaceMode } from "@/lib/personal-settings";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

vi.mock("@/lib/personal-settings", () => ({
  applyInterfaceMode: vi.fn(),
}));

let currentAuth: ReturnType<typeof useAuth> | null = null;

function AuthProbe() {
  currentAuth = useAuth();
  return (
    <output data-loading={String(currentAuth.loading)} data-user={currentAuth.user?.id ?? "none"} />
  );
}

function createAuthClient(session: Session | null = null) {
  let authChange: ((event: string, session: Session | null) => void) | undefined;
  const unsubscribe = vi.fn();
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session } }),
    onAuthStateChange: vi.fn((callback) => {
      authChange = callback;
      return { data: { subscription: { unsubscribe } } };
    }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  const profileBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { interface_mode: "dark" } }),
  };
  profileBuilder.select.mockReturnValue(profileBuilder);
  profileBuilder.eq.mockReturnValue(profileBuilder);
  return {
    client: { auth, from: vi.fn(() => profileBuilder) },
    auth,
    profileBuilder,
    unsubscribe,
    emit(event: string, nextSession: Session | null) {
      authChange?.(event, nextSession);
    },
  };
}

const session = {
  access_token: "token",
  refresh_token: "refresh",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "user-1" },
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  currentAuth = null;
  window.localStorage.clear();
});

afterEach(cleanup);

describe("AuthProvider", () => {
  it("provides a non-blocking signed-out state without configuration", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(currentAuth?.loading).toBe(false));
    expect(currentAuth?.user).toBeNull();
    await expect(currentAuth?.signIn("a@example.com", "password")).rejects.toThrow(
      "not configured",
    );
    await expect(currentAuth?.signUp("A", "a@example.com", "password")).rejects.toThrow(
      "not configured",
    );
    await expect(currentAuth?.signInWithProvider("google")).rejects.toThrow("not configured");
    await expect(currentAuth?.requestPasswordReset("a@example.com")).rejects.toThrow(
      "not configured",
    );
    await expect(currentAuth?.updatePassword("new password")).rejects.toThrow("not configured");
    await expect(currentAuth?.signOut()).rejects.toThrow("not configured");
  });

  it("loads a session, profile mode, and exposes successful auth actions", async () => {
    const harness = createAuthClient(session);
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(harness.client as never);
    window.localStorage.setItem("sf-interface-mode", "light");
    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(currentAuth?.user?.id).toBe("user-1"));
    await waitFor(() => expect(harness.profileBuilder.maybeSingle).toHaveBeenCalled());
    expect(applyInterfaceMode).toHaveBeenCalledWith("light");
    expect(applyInterfaceMode).toHaveBeenCalledWith("dark");

    await currentAuth?.signIn("a@example.com", "password");
    await expect(currentAuth?.signUp("Ada", "a@example.com", "password")).resolves.toEqual({
      needsEmailConfirmation: false,
    });
    await currentAuth?.signInWithProvider("google");
    await currentAuth?.requestPasswordReset("a@example.com");
    await currentAuth?.updatePassword("new password");
    await currentAuth?.signOut();

    expect(harness.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password",
    });
    expect(harness.auth.signUp).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password",
      options: { data: { full_name: "Ada" } },
    });
    expect(harness.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    expect(harness.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.com", {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    expect(harness.auth.updateUser).toHaveBeenCalledWith({ password: "new password" });

    view.unmount();
    expect(harness.unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports email confirmation when sign-up has no session", async () => {
    const harness = createAuthClient(null);
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(harness.client as never);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(currentAuth?.loading).toBe(false));
    await expect(currentAuth?.signUp("Ada", "a@example.com", "password")).resolves.toEqual({
      needsEmailConfirmation: true,
    });
  });

  it("reacts to auth changes and uses system mode for invalid stored values", async () => {
    const harness = createAuthClient(null);
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(harness.client as never);
    window.localStorage.setItem("sf-interface-mode", "invalid");
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(currentAuth?.loading).toBe(false));

    await act(() => harness.emit("SIGNED_IN", session));
    expect(currentAuth?.user?.id).toBe("user-1");
    expect(applyInterfaceMode).toHaveBeenCalledWith("system");
  });

  it("recovers when initial session or optional profile loading fails", async () => {
    const sessionFailure = createAuthClient(null);
    sessionFailure.auth.getSession.mockRejectedValue(new Error("session failed"));
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(sessionFailure.client as never);
    const first = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(currentAuth?.loading).toBe(false));
    expect(currentAuth?.session).toBeNull();
    first.unmount();

    const profileFailure = createAuthClient(session);
    profileFailure.profileBuilder.maybeSingle.mockRejectedValue(new Error("profile failed"));
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(profileFailure.client as never);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(currentAuth?.user?.id).toBe("user-1"));
  });

  it("surfaces errors from every auth action", async () => {
    const harness = createAuthClient(null);
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(harness.client as never);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(currentAuth?.loading).toBe(false));

    const cases = [
      [harness.auth.signInWithPassword, () => currentAuth?.signIn("a@example.com", "password")],
      [harness.auth.signUp, () => currentAuth?.signUp("A", "a@example.com", "password")],
      [harness.auth.signInWithOAuth, () => currentAuth?.signInWithProvider("github")],
      [
        harness.auth.resetPasswordForEmail,
        () => currentAuth?.requestPasswordReset("a@example.com"),
      ],
      [harness.auth.updateUser, () => currentAuth?.updatePassword("password")],
      [harness.auth.signOut, () => currentAuth?.signOut()],
    ] as const;

    for (const [method, action] of cases) {
      method.mockResolvedValueOnce({ data: null, error: new Error("auth failed") } as never);
      await expect(action()).rejects.toThrow("auth failed");
    }
  });
});

describe("useAuth", () => {
  it("rejects use outside its provider", () => {
    expect(() => render(<AuthProbe />)).toThrow("useAuth must be used inside AuthProvider");
  });
});

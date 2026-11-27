import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";

const navigate = vi.fn();
let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

const actions = {
  signIn: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue({ needsEmailConfirmation: false }),
  signInWithProvider: vi.fn().mockResolvedValue(undefined),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  updatePassword: vi.fn().mockResolvedValue(undefined),
};

function authValue(overrides = {}) {
  return { user: null, loading: false, ...actions, ...overrides };
}

async function renderAuth() {
  const { Route } = await import("@/routes/auth");
  const Component = (Route as unknown as { component: React.ComponentType }).component;

  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  search = {};
  vi.mocked(useAuth).mockReturnValue(authValue() as never);
});

afterEach(cleanup);

describe("auth route", () => {
  it("shows its loading state and redirects an existing user", async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }) as never);
    const view = await renderAuth();
    expect(screen.getByTestId("loading-splash")).toBeTruthy();
    view.unmount();

    vi.mocked(useAuth).mockReturnValue(authValue({ user: { id: "user-1" } }) as never);
    await renderAuth();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("signs in with email and toggles password visibility", async () => {
    await renderAuth();
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Toggle password" }));
    expect(password.getAttribute("type")).toBe("text");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(password, { target: { value: "password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(actions.signIn).toHaveBeenCalledWith("ada@example.com", "password"));
  });

  it("surfaces provider and password sign-in failures", async () => {
    actions.signInWithProvider.mockRejectedValueOnce(new Error("Google failed"));
    await renderAuth();
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByText("Google failed")).toBeTruthy();

    actions.signIn.mockRejectedValueOnce("bad response");
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(await screen.findByText("Something went wrong.")).toBeTruthy();
  });

  it("registers, validates terms, and shows email verification", async () => {
    actions.signUp.mockResolvedValueOnce({ needsEmailConfirmation: true });
    await renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByLabelText(/I agree/));
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeTruthy();
    expect(screen.getByText(/ada@example.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in to Scaffold CMS" })).toBeTruthy();
  });

  it("returns from registration without submitting", async () => {
    await renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in to Scaffold CMS" })).toBeTruthy();
  });

  it("requests a password reset and shows confirmation", async () => {
    await renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form")!);
    expect(await screen.findByText(/reset link is on its way/)).toBeTruthy();
    expect(actions.requestPasswordReset).toHaveBeenCalledWith("ada@example.com");
  });

  it("lets a user arriving from a reset link set a new password (5.4)", async () => {
    search = { mode: "reset" };
    vi.mocked(useAuth).mockReturnValue(authValue({ user: { id: "user-1" } }) as never);
    await renderAuth();

    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Repeat new password"), {
      target: { value: "long-password" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save new password" }).closest("form")!);

    await waitFor(() => expect(actions.updatePassword).toHaveBeenCalledWith("long-password"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("also shows the form on the Supabase password recovery event", async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ user: { id: "user-1" }, passwordRecovery: true }) as never,
    );
    await renderAuth();

    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy();
  });

  it("rejects mismatched or short passwords without calling Supabase", async () => {
    search = { mode: "reset" };
    vi.mocked(useAuth).mockReturnValue(authValue({ user: { id: "user-1" } }) as never);
    await renderAuth();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "long-password" } });
    fireEvent.change(screen.getByLabelText("Repeat new password"), {
      target: { value: "other-password" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save new password" }).closest("form")!);

    expect(await screen.findByText("The passwords do not match.")).toBeTruthy();
    expect(actions.updatePassword).not.toHaveBeenCalled();
  });

  it("explains an expired reset link when nobody is signed in", async () => {
    search = { mode: "reset" };
    await renderAuth();

    expect(screen.getByText(/reset link has expired/)).toBeTruthy();
  });
});

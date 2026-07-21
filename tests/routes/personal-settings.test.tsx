import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import {
  applyInterfaceMode,
  changePassword,
  loadPersonalSettings,
  savePersonalSettings,
  usesPasswordAuthentication,
} from "@/lib/personal-settings";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/personal-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/personal-settings")>()),
  applyInterfaceMode: vi.fn(),
  changePassword: vi.fn(),
  loadPersonalSettings: vi.fn(),
  savePersonalSettings: vi.fn(),
  usesPasswordAuthentication: vi.fn(),
}));

vi.mock("@/components/loading", () => ({
  LoadingSplash: () => <div>Authentication loading</div>,
  RouteLoading: ({ title }: { title: string }) => <div>{title}</div>,
}));

const settings = {
  firstName: "Tom",
  lastName: "Klein",
  email: "tom@example.com",
  displayName: "Tom Klein",
  interfaceLanguage: "en",
  interfaceMode: "system" as const,
};

const user = {
  id: "user-1",
  email: "tom@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
};

async function renderRoute() {
  const { Route } = await import("@/routes/personal-settings");
  const Component = (Route as unknown as { component: React.ComponentType }).component;
  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user, loading: false } as never);
  vi.mocked(loadPersonalSettings).mockResolvedValue(settings);
  vi.mocked(savePersonalSettings).mockResolvedValue({ emailConfirmationPending: false });
  vi.mocked(changePassword).mockResolvedValue(undefined);
  vi.mocked(usesPasswordAuthentication).mockReturnValue(true);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(cleanup);

describe("personal settings route", () => {
  it("shows authentication and profile loading states", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    const auth = await renderRoute();
    expect(screen.getByText("Authentication loading")).toBeTruthy();
    auth.unmount();

    vi.mocked(useAuth).mockReturnValue({ user, loading: false } as never);
    let resolveSettings: (value: typeof settings) => void = () => undefined;
    vi.mocked(loadPersonalSettings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSettings = resolve;
      }),
    );
    await renderRoute();
    expect(screen.getByText("Loading settings")).toBeTruthy();
    resolveSettings(settings);
    expect(await screen.findByText("Tom Klein")).toBeTruthy();
  });

  it("redirects signed-out users", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never);
    await renderRoute();
    expect(screen.getByText("Loading settings")).toBeTruthy();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth" }));
  });

  it("edits, discards, changes appearance, and saves the profile", async () => {
    await renderRoute();
    expect(await screen.findByText("Tom Klein")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("Tom"), { target: { value: "Thomas" } });
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(applyInterfaceMode).toHaveBeenCalledWith("dark");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByDisplayValue("Tom")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("Tom"), { target: { value: "Thomas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(savePersonalSettings).toHaveBeenCalledWith(
        user,
        expect.objectContaining({ firstName: "Thomas" }),
      ),
    );
    expect((await screen.findByRole("status")).textContent).toContain("Personal settings saved");
  });

  it("validates and updates a password", async () => {
    await renderRoute();
    await screen.findByText("Change password");
    fireEvent.change(screen.getByPlaceholderText("Enter current password"), {
      target: { value: "old-password" },
    });
    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Repeat new password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        email: "tom@example.com",
        currentPassword: "old-password",
        newPassword: "new-password-123",
      }),
    );
    expect((await screen.findByRole("status")).textContent).toContain("Password updated");
  });

  it("shows provider guidance and reports loading and save failures", async () => {
    vi.mocked(usesPasswordAuthentication).mockReturnValue(false);
    vi.mocked(loadPersonalSettings).mockRejectedValueOnce(new Error("profile unavailable"));
    const failed = await renderRoute();
    expect(await screen.findByText("profile unavailable")).toBeTruthy();
    failed.unmount();

    vi.mocked(loadPersonalSettings).mockResolvedValue(settings);
    vi.mocked(savePersonalSettings).mockRejectedValueOnce(new Error("save failed"));
    await renderRoute();
    expect(await screen.findByText("Password managed by Google")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Tom"), { target: { value: "Thomas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("save failed")).toBeTruthy();
  });

  it("guards navigation when unsaved changes exist", async () => {
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await renderRoute();
    await screen.findByText("Tom Klein");
    fireEvent.change(screen.getByDisplayValue("Tom"), { target: { value: "Thomas" } });
    fireEvent.click(screen.getByRole("button", { name: "Back to app" }));
    expect(navigate).not.toHaveBeenCalledWith({ to: "/" });
    fireEvent.click(screen.getByRole("button", { name: "Back to app" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
    confirm.mockRestore();
  });
});

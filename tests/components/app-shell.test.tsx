import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell, StatusPill } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("AppShell", () => {
  it("shows loading and redirects signed-out visitors", async () => {
    vi.mocked(useAuth).mockReturnValue({ loading: false, user: null, signOut: vi.fn() } as never);
    render(<AppShell active="pages">Content</AppShell>);
    expect(screen.getByTestId("loading-splash")).toBeTruthy();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth" }));
  });

  it("renders navigation, selects workspaces, navigates, and signs out", () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const selectWorkspace = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      loading: false,
      user: {
        id: "user-1",
        email: "ada@example.com",
        user_metadata: { full_name: "Ada Lovelace" },
      },
      signOut,
    } as never);
    render(
      <AppShell
        active="pages"
        languageCode="en"
        languageName="English"
        onWorkspaceSelect={selectWorkspace}
        pageCount={48}
        siteName="Site one"
        workspaces={[
          {
            siteId: "site-1",
            siteName: "Site one",
            languageId: "language-1",
            languageName: "English",
            languageCode: "en",
          },
          {
            siteId: "site-2",
            siteName: "Site two",
            languageId: "language-2",
            languageName: "Nederlands",
            languageCode: "nl",
          },
        ]}
      >
        <p>Workspace content</p>
      </AppShell>,
    );

    expect(screen.getByText("Workspace content")).toBeTruthy();
    expect(screen.getByText("48")).toBeTruthy();
    expect(screen.getByText("AL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Site one/ }));
    fireEvent.click(screen.getByRole("button", { name: /Site two/ }));
    expect(selectWorkspace).toHaveBeenCalledWith(expect.objectContaining({ siteId: "site-2" }));

    fireEvent.click(screen.getByRole("button", { name: "Media" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/media" });
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Open personal settings" }).getAttribute("href")).toBe(
      "/personal-settings",
    );
  });

  it("falls back to the email name and supports an empty workspace list", () => {
    vi.mocked(useAuth).mockReturnValue({
      loading: false,
      user: { id: "user-1", email: "editor@example.com", user_metadata: {} },
      signOut: vi.fn(),
    } as never);
    render(
      <AppShell active="settings" workspaces={[]}>
        Content
      </AppShell>,
    );
    expect(screen.getByText("editor")).toBeTruthy();
    expect(screen.getByText("E")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /My first site/ }));
    expect(screen.queryByText("Nederlands")).toBeNull();
  });
});

describe("StatusPill", () => {
  it.each([
    ["Published", "text-published"],
    ["Concept", "text-concept"],
    ["Needs attention", "text-danger"],
  ] as const)("maps %s to its semantic state", (status, className) => {
    render(<StatusPill status={status} />);
    const pill = screen.getByText(status);
    expect(pill.getAttribute("data-status")).toBe(status);
    expect(pill.className).toContain(className);
    cleanup();
  });
});

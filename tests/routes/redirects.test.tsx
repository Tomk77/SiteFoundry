import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import {
  deleteRedirect,
  loadRedirectWorkspace,
  saveRedirect,
  type RedirectWorkspace,
} from "@/lib/redirects";

const navigate = vi.fn();
let search: { q?: string; filter?: "all" | "automatic" | "manual" | "attention" } = {};
let userNumber = 0;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/redirects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/redirects")>()),
  deleteRedirect: vi.fn(),
  loadRedirectWorkspace: vi.fn(),
  saveRedirect: vi.fn(),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    children,
    onWorkspaceSelect,
  }: {
    children: React.ReactNode;
    onWorkspaceSelect?: (value: unknown) => void;
  }) => (
    <div>
      <button onClick={() => onWorkspaceSelect?.({ siteId: "site-2", languageId: "lang-2" })}>
        Switch workspace
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/loading", () => ({
  AppShellSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("@/components/modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  ModalClose: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  ModalDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  ModalTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

const workspace: RedirectWorkspace = {
  site: { id: "site-1", name: "Site one", slug: "site-one" },
  language: { id: "lang-1", code: "en", name: "English" },
  workspaces: [],
  pages: [],
  pageCount: 12,
  lastUpdatedAt: "2026-07-15",
  livePages: [
    { id: "home", title: "Home", path: "/" },
    { id: "news", title: "News", path: "/news" },
  ],
  redirects: [
    {
      id: "manual",
      siteLanguageId: "lang-1",
      pageId: null,
      sourcePath: "/old-news",
      destinationPath: "/news",
      statusCode: 301,
      createdAt: new Date().toISOString(),
      pageTitle: null,
    },
    {
      id: "automatic",
      siteLanguageId: "lang-1",
      pageId: "page-1",
      sourcePath: "/old-team",
      destinationPath: "/missing",
      statusCode: 302,
      createdAt: "2026-06-01",
      pageTitle: "Team",
    },
  ],
};

async function renderRoute() {
  const { Route } = await import("@/routes/redirects");
  const Component = (Route as unknown as { component: React.ComponentType }).component;

  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  search = {};
  userNumber += 1;
  vi.mocked(useAuth).mockReturnValue({ user: { id: `user-${userNumber}` } } as never);
  vi.mocked(loadRedirectWorkspace).mockResolvedValue(workspace);
  vi.mocked(saveRedirect).mockResolvedValue("redirect-1");
  vi.mocked(deleteRedirect).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("redirects route", () => {
  it("loads redirects, updates URL search and filters, and switches workspace", async () => {
    await renderRoute();
    expect(screen.getByText("Loading redirects")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Redirects" })).toBeTruthy();
    expect(screen.getByText("Broken target")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search source or target..."), {
      target: { value: "team" },
    });
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ search: { q: "team" } }));
    fireEvent.click(screen.getAllByRole("button", { name: /Manual/ })[0]!);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { filter: "manual" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch workspace" }));
    expect(loadRedirectWorkspace).toHaveBeenLastCalledWith({
      siteId: "site-2",
      languageId: "lang-2",
    });
  });

  it("validates and creates a manual redirect", async () => {
    await renderRoute();
    await screen.findByText("/old-news");
    fireEvent.click(screen.getByRole("button", { name: /Add redirect/ }));
    expect(screen.getByRole("heading", { name: "Add redirect" })).toBeTruthy();
    expect(screen.getByText("Enter a source path.")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("/old-path"), {
      target: { value: "/campaign" },
    });
    fireEvent.change(screen.getByPlaceholderText("/new-path"), { target: { value: "/news" } });
    expect(screen.getByText("Live page")).toBeTruthy();
    fireEvent.click(document.querySelectorAll(".sc-redirect-modal-body fieldset button")[1]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Add redirect" }).at(-1)!);
    await waitFor(() =>
      expect(saveRedirect).toHaveBeenCalledWith({
        id: undefined,
        siteLanguageId: "lang-1",
        sourcePath: "/campaign",
        destinationPath: "/news",
        statusCode: 302,
      }),
    );
    expect(await screen.findByText("Redirect created")).toBeTruthy();
  });

  it("edits and deletes redirect rows and surfaces persistence failures", async () => {
    await renderRoute();
    await screen.findByText("/old-news");
    fireEvent.click(screen.getByText("/old-news").closest('[role="button"]')!);
    expect(screen.getByRole("heading", { name: "Edit redirect" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("/new-path"), { target: { value: "/" } });
    fireEvent.click(screen.getByRole("button", { name: "Save redirect" }));
    await waitFor(() => expect(saveRedirect).toHaveBeenCalled());

    vi.mocked(deleteRedirect).mockRejectedValueOnce(new Error("delete failed"));
    fireEvent.click(screen.getAllByTitle("Delete")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Delete redirect" }));
    expect(await screen.findByText("delete failed")).toBeTruthy();
    vi.mocked(deleteRedirect).mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Delete redirect" }));
    expect(await screen.findByText("Redirect deleted")).toBeTruthy();
  });

  it("shows empty and failed workspace states", async () => {
    vi.mocked(loadRedirectWorkspace).mockResolvedValueOnce({ ...workspace, redirects: [] });
    let view = await renderRoute();
    expect(await screen.findByText("No redirects yet")).toBeTruthy();
    view.unmount();

    vi.mocked(loadRedirectWorkspace).mockRejectedValueOnce(new Error("offline"));
    view = await renderRoute();
    expect(await screen.findByText("offline")).toBeTruthy();
    view.unmount();

    vi.mocked(loadRedirectWorkspace).mockResolvedValueOnce(null);
    await renderRoute();
    expect(await screen.findByText("No website is available.")).toBeTruthy();
  });
});

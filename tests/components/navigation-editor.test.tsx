import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import {
  loadNavigationWorkspace,
  publishNavigation,
  saveNavigationDraft,
  type NavigationItem,
  type NavigationWorkspace,
} from "@/lib/navigation";
import { NavigationEditor } from "@/features/navigation/navigation-editor";

const navigate = vi.fn();
let userNumber = 0;

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/navigation")>()),
  loadNavigationWorkspace: vi.fn(),
  publishNavigation: vi.fn(),
  saveNavigationDraft: vi.fn(),
}));
vi.mock("@/components/loading", () => ({
  LoadingSplash: () => <div>Authentication loading</div>,
  RouteLoading: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock("@/components/modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  ModalClose: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  ModalTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  ModalDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const child: NavigationItem = {
  id: "child-1",
  kind: "link",
  label: "About",
  target: "/about",
  targetType: "page",
  newTab: false,
  children: [],
};
const items: NavigationItem[] = [
  {
    id: "home",
    kind: "link",
    label: "Home",
    target: "/",
    targetType: "page",
    newTab: false,
    children: [],
  },
  {
    id: "company",
    kind: "group",
    label: "Company",
    target: "",
    targetType: "page",
    newTab: false,
    children: [child],
  },
  {
    id: "contact",
    kind: "button",
    label: "Contact",
    target: "/missing",
    targetType: "page",
    newTab: false,
    children: [],
  },
];

const workspace: NavigationWorkspace = {
  site: { id: "site-1", name: "Acme", slug: "acme" },
  language: { id: "language-1", code: "en", name: "English" },
  workspaces: [],
  pages: [],
  pageCount: 2,
  lastUpdatedAt: "2026-07-15T12:00:00Z",
  menuId: "menu-1",
  location: "header",
  items,
  publishedItems: items,
  publishedAt: "2026-07-15T12:00:00Z",
  pageOptions: [
    { id: "page-home", title: "Home", path: "/" },
    { id: "page-about", title: "About", path: "/about" },
  ],
};

function clickBuilderItem(label: string) {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".sf-menu-card-copy"),
  ).find((item) => item.textContent?.includes(label));
  if (!button) throw new Error(`No builder item found for ${label}`);
  fireEvent.click(button);
}

beforeEach(() => {
  vi.clearAllMocks();
  userNumber += 1;
  vi.mocked(useAuth).mockReturnValue({
    user: { id: `navigation-user-${userNumber}` },
    loading: false,
  } as never);
  vi.mocked(loadNavigationWorkspace).mockResolvedValue(structuredClone(workspace));
  vi.mocked(saveNavigationDraft).mockResolvedValue("2026-07-15T12:00:00Z");
  vi.mocked(publishNavigation).mockResolvedValue({
    updated_at: "2026-07-15T12:00:00Z",
    published_at: "2026-07-15T12:00:00Z",
  });
});

afterEach(cleanup);

describe("NavigationEditor", () => {
  it("shows authentication, workspace loading, empty, and failure states", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    const auth = render(<NavigationEditor location="header" />);
    expect(screen.getByText("Authentication loading")).toBeTruthy();
    auth.unmount();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: `loading-${userNumber}` },
      loading: false,
    } as never);
    let resolveWorkspace: (value: NavigationWorkspace | null) => void = () => undefined;
    vi.mocked(loadNavigationWorkspace).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );
    const loading = render(<NavigationEditor location="header" />);
    expect(screen.getByText("Loading header navigation")).toBeTruthy();
    resolveWorkspace(workspace);
    expect(await screen.findByText("Menu structure")).toBeTruthy();
    loading.unmount();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: `empty-${userNumber}` },
      loading: false,
    } as never);
    vi.mocked(loadNavigationWorkspace).mockResolvedValueOnce(null);
    const empty = render(<NavigationEditor location="header" />);
    expect(await screen.findByText("No website is available.")).toBeTruthy();
    empty.unmount();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: `failed-${userNumber}` },
      loading: false,
    } as never);
    vi.mocked(loadNavigationWorkspace).mockRejectedValueOnce(new Error("navigation unavailable"));
    render(<NavigationEditor location="header" />);
    expect(await screen.findByText("navigation unavailable")).toBeTruthy();
  });

  it("edits, reorders, and removes header items", async () => {
    const { container } = render(<NavigationEditor location="header" />);
    expect(await screen.findByText("Menu structure")).toBeTruthy();
    clickBuilderItem("Home");
    fireEvent.change(document.querySelector("#navigation-label-home")!, {
      target: { value: "Homepage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Custom URL" }));
    fireEvent.change(screen.getByDisplayValue("https://"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Open in a new tab/ }));
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    fireEvent.click(screen.getAllByTitle("Move down")[0]!);
    fireEvent.click(container.querySelector(".sf-remove-item")!);
    expect(screen.getByRole("status").textContent).toContain("Removed");
  });

  it("manages dropdown children and mobile preview", async () => {
    render(<NavigationEditor location="header" />);
    await screen.findByText("Menu structure");
    clickBuilderItem("Company");
    fireEvent.change(screen.getByLabelText("Link label"), { target: { value: "Our company" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link to dropdown" }));
    expect(screen.getAllByLabelText("Link label")).toHaveLength(2);
    fireEvent.click(screen.getAllByTitle("Remove link")[0]!);

    fireEvent.click(screen.getByTitle("Mobile"));
    const mobileCompany = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".sf-mobile-header-preview button"),
    ).find((button) => button.textContent?.includes("Company"));
    fireEvent.click(mobileCompany!);
    expect(screen.getByText("New link")).toBeTruthy();
  });

  it("adds menu item kinds and saves a draft", async () => {
    render(<NavigationEditor location="header" />);
    await screen.findByText("Menu structure");
    fireEvent.click(screen.getByRole("button", { name: "Add menu item" }));
    fireEvent.click(screen.getByRole("button", { name: /Custom URL/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(saveNavigationDraft).toHaveBeenCalledWith("menu-1", expect.any(Array)),
    );
    expect((await screen.findByRole("status")).textContent).toContain("draft saved");
  });

  it("warns about broken links and publishes anyway", async () => {
    render(<NavigationEditor location="header" />);
    expect(await screen.findByText("1 broken link")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }));
    expect(screen.getByText("Publish with broken links?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish anyway" }));
    await waitFor(() =>
      expect(publishNavigation).toHaveBeenCalledWith("menu-1", expect.any(Array)),
    );
    expect((await screen.findByRole("status")).textContent).toContain("published");
  });

  it("reports save and publish failures", async () => {
    vi.mocked(saveNavigationDraft).mockRejectedValueOnce(new Error("draft failed"));
    vi.mocked(publishNavigation).mockRejectedValueOnce(new Error("publish failed"));
    const cleanWorkspace = {
      ...workspace,
      items: items.filter((item) => item.id !== "contact"),
      publishedItems: [],
    };
    vi.mocked(loadNavigationWorkspace).mockResolvedValueOnce(cleanWorkspace);
    render(<NavigationEditor location="header" />);
    await screen.findByText("Menu structure");
    clickBuilderItem("Home");
    fireEvent.change(document.querySelector("#navigation-label-home")!, {
      target: { value: "Homepage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("draft failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }));
    expect(await screen.findByText("publish failed")).toBeTruthy();
  });

  it("renders footer preview and footer-specific additions", async () => {
    render(<NavigationEditor location="footer" />);
    expect(await screen.findByText("Footer content")).toBeTruthy();
    expect(screen.getByText(/website-native/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to footer" }));
    fireEvent.click(screen.getByRole("button", { name: /Link column/ }));
    expect(screen.getByDisplayValue("New column")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Refresh preview"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import { loadPageTemplates } from "@/lib/page-templates-data";
import type { PageTemplateDefinition } from "@/lib/page-templates";
import {
  createChildPage,
  deletePage,
  loadPageTreeWorkspace,
  movePage,
  renamePage,
  unpublishPage,
  type PageNode,
  type PageTreeWorkspace,
} from "@/lib/page-tree";

const navigate = vi.fn();
let search: Record<string, unknown> = {};
let userNumber = 0;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/page-templates-data", () => ({ loadPageTemplates: vi.fn() }));
vi.mock("@/lib/page-tree", () => ({
  createChildPage: vi.fn(),
  deletePage: vi.fn(),
  loadPageTreeWorkspace: vi.fn(),
  movePage: vi.fn(),
  renamePage: vi.fn(),
  unpublishPage: vi.fn(),
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
  StatusPill: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/components/loading", () => ({
  AppShellSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
  LoadingSplash: () => <div>Auth loading</div>,
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

const child: PageNode = {
  id: "article",
  parentId: "home",
  title: "Article",
  slug: "/article",
  template: "Standard page",
  templateId: "template-1",
  templateKey: "standard-page",
  status: "Concept",
  validation: "Needs attention",
  updatedAt: "2026-07-15",
  isHomepage: false,
  preferredChildTemplate: null,
  children: [],
};

const home: PageNode = {
  id: "home",
  parentId: null,
  title: "Home",
  slug: "/",
  template: "Landing page",
  templateId: "template-1",
  templateKey: "standard-page",
  status: "Published",
  validation: "Ready",
  updatedAt: "2026-07-15",
  isHomepage: true,
  preferredChildTemplate: "standard-page",
  children: [child],
};

const workspace: PageTreeWorkspace = {
  site: { id: "site-1", name: "Site one", slug: "site-one" },
  language: { id: "lang-1", code: "en", name: "English" },
  workspaces: [],
  pages: [home],
  pageCount: 2,
  lastUpdatedAt: "2026-07-15",
};

const template: PageTemplateDefinition = {
  id: "template-1",
  key: "standard-page",
  name: "Standard page",
  description: "Default page structure",
  icon: "ph-file",
  status: "published",
  fallback: true,
  defaults: { seoTitle: "", seoDescription: "Description" },
  preview: "/preview/standard-page",
  components: [{ type: "hero", values: { headline: "Title" } }],
  revisions: [],
};

async function renderRoute() {
  const { Route } = await import("@/routes/index");
  const Component = (Route as unknown as { component: React.ComponentType }).component;

  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  search = {};
  userNumber += 1;
  vi.mocked(useAuth).mockReturnValue({
    user: { id: `tree-user-${userNumber}` },
    loading: false,
  } as never);
  vi.mocked(loadPageTreeWorkspace).mockResolvedValue(workspace);
  vi.mocked(loadPageTemplates).mockResolvedValue([template]);
  vi.mocked(createChildPage).mockResolvedValue("new-page");
  vi.mocked(renamePage).mockResolvedValue(undefined);
  vi.mocked(deletePage).mockResolvedValue(undefined);
  vi.mocked(unpublishPage).mockResolvedValue(undefined);
  vi.mocked(movePage).mockResolvedValue({
    reparented: false,
    parentTitle: "Home",
    affectedPages: 1,
    publishedPages: 0,
    redirectsCreated: 0,
  });
});

afterEach(cleanup);

describe("page tree route", () => {
  it("shows auth and page loading states", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    const auth = await renderRoute();
    expect(screen.getByText("Auth loading")).toBeTruthy();
    auth.unmount();

    vi.mocked(useAuth).mockReturnValue({ user: { id: "pending-user" }, loading: false } as never);
    let resolveWorkspace: (value: PageTreeWorkspace) => void = () => undefined;
    vi.mocked(loadPageTreeWorkspace).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );
    await renderRoute();
    expect(screen.getByText("Loading your page tree")).toBeTruthy();
    resolveWorkspace(workspace);
    expect(await screen.findByRole("heading", { name: "Pages" })).toBeTruthy();
  });

  it("renders, navigates, expands, filters, and switches workspaces", async () => {
    const view = await renderRoute();
    expect(await screen.findByText("Home")).toBeTruthy();
    expect(screen.getByText("Article")).toBeTruthy();
    fireEvent.click(screen.getByRole("treeitem", { name: /Article/ }));
    expect(navigate).toHaveBeenCalledWith({ to: "/editor", search: { page: "article" } });

    fireEvent.change(screen.getByLabelText("Search pages"), { target: { value: "article" } });
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ search: { q: "article" } }));
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Concept" } });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ status: "concept" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(view.container.querySelectorAll('[role="treeitem"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Switch workspace" }));
    expect(loadPageTreeWorkspace).toHaveBeenLastCalledWith({
      siteId: "site-2",
      languageId: "lang-2",
    });
  });

  it("creates a page from the selected template", async () => {
    await renderRoute();
    await screen.findByText("Home");
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(screen.getByRole("heading", { name: "Add page" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Untitled page"), {
      target: { value: "Campaign page" },
    });
    expect(screen.getByDisplayValue("campaign-page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create as concept" }));
    await waitFor(() =>
      expect(createChildPage).toHaveBeenCalledWith({
        languageId: "lang-1",
        parentId: "home",
        title: "Campaign page",
        slug: "campaign-page",
        template,
      }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/editor", search: { page: "new-page" } });
  });

  it("quick-creates, renames, and deletes leaf pages", async () => {
    await renderRoute();
    await screen.findByText("Article");
    fireEvent.click(screen.getByRole("button", { name: "Add under Home" }));
    fireEvent.click(screen.getByRole("button", { name: /Add Standard page/ }));
    await waitFor(() => expect(createChildPage).toHaveBeenCalled());
    expect(await screen.findByText("Page created")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "More actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename title" }));
    fireEvent.change(screen.getByDisplayValue("Article"), { target: { value: "New article" } });
    fireEvent.click(screen.getByRole("button", { name: "Save title" }));
    await waitFor(() => expect(renamePage).toHaveBeenCalledWith("article", "New article"));

    fireEvent.click(screen.getByRole("button", { name: "More actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    expect(screen.getByRole("heading", { name: "Delete page?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    await waitFor(() => expect(deletePage).toHaveBeenCalledWith("article"));
  });

  it("unpublishes a published page after confirmation", async () => {
    vi.mocked(loadPageTreeWorkspace).mockResolvedValue({
      ...workspace,
      pages: [{ ...home, children: [{ ...child, status: "Published" }] }],
    });
    await renderRoute();
    await screen.findByText("Article");

    fireEvent.click(screen.getByRole("button", { name: "More actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Unpublish page" }));
    expect(screen.getByRole("heading", { name: "Unpublish page?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    await waitFor(() => expect(unpublishPage).toHaveBeenCalledWith("article"));
    expect(await screen.findByText("Page unpublished")).toBeTruthy();
  });

  it("does not offer unpublish for concept pages or the homepage", async () => {
    await renderRoute();
    await screen.findByText("Article");

    fireEvent.click(screen.getByRole("button", { name: "More actions for Article" }));
    expect(screen.queryByRole("button", { name: "Unpublish page" })).toBeNull();
  });

  it("shows load, template, and empty-filter failures", async () => {
    vi.mocked(loadPageTreeWorkspace).mockRejectedValueOnce(new Error("offline"));
    let view = await renderRoute();
    expect(await screen.findByText("offline")).toBeTruthy();
    view.unmount();

    vi.mocked(loadPageTemplates).mockRejectedValueOnce(new Error("templates offline"));
    view = await renderRoute();
    await screen.findByText("Home");
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(screen.getByText("Templates could not be loaded")).toBeTruthy();
    view.unmount();

    search = { q: "missing" };
    await renderRoute();
    expect(await screen.findByText("No pages found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  });

  it("reviews descendant URL changes before moving a page", async () => {
    const grandchild: PageNode = {
      ...child,
      id: "grandchild",
      parentId: "article",
      title: "Grandchild",
      slug: "/article/grandchild",
    };
    const articleWithChild = { ...child, children: [grandchild] };
    const products: PageNode = {
      ...home,
      id: "products",
      title: "Products",
      slug: "/products",
      isHomepage: false,
      children: [],
    };
    vi.mocked(loadPageTreeWorkspace).mockResolvedValue({
      ...workspace,
      pageCount: 4,
      pages: [{ ...home, children: [articleWithChild] }, products],
    });
    vi.mocked(movePage).mockResolvedValueOnce({
      reparented: true,
      parentTitle: "Home",
      affectedPages: 2,
      publishedPages: 1,
      redirectsCreated: 1,
    });
    await renderRoute();
    const articleRow = await screen.findByRole("treeitem", { name: /Article/ });
    const productsRow = screen.getByRole("treeitem", { name: /Products/ });
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
    fireEvent.dragStart(articleRow, { dataTransfer });
    Object.defineProperty(productsRow, "getBoundingClientRect", {
      value: () => ({ top: 0, height: 100 }),
    });
    fireEvent.dragOver(productsRow, { dataTransfer, clientY: 50 });
    fireEvent.drop(productsRow, { dataTransfer });
    expect(await screen.findByRole("heading", { name: "Review URL changes" })).toBeTruthy();
    expect(screen.getByText("2 URLs will change.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));
    await waitFor(() =>
      expect(movePage).toHaveBeenCalledWith({
        pageId: "article",
        targetId: "products",
        position: "inside",
        createRedirects: false,
      }),
    );
    expect((await screen.findByRole("status")).textContent).toContain("Moved");
  });

  it("reviews the URL change when a published leaf page moves to a new parent", async () => {
    const products: PageNode = {
      ...home,
      id: "products",
      title: "Products",
      slug: "/products",
      isHomepage: false,
      children: [],
    };
    vi.mocked(loadPageTreeWorkspace).mockResolvedValue({
      ...workspace,
      pageCount: 3,
      pages: [{ ...home, children: [{ ...child, status: "Published" }] }, products],
    });
    await renderRoute();
    const articleRow = await screen.findByRole("treeitem", { name: /Article/ });
    const productsRow = screen.getByRole("treeitem", { name: /Products/ });
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
    fireEvent.dragStart(articleRow, { dataTransfer });
    Object.defineProperty(productsRow, "getBoundingClientRect", {
      value: () => ({ top: 0, height: 100 }),
    });
    fireEvent.dragOver(productsRow, { dataTransfer, clientY: 50 });
    fireEvent.drop(productsRow, { dataTransfer });

    expect(await screen.findByRole("heading", { name: "Review URL changes" })).toBeTruthy();
    expect(movePage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));
    await waitFor(() =>
      expect(movePage).toHaveBeenCalledWith(expect.objectContaining({ createRedirects: true })),
    );
  });

  it("reports create, rename, delete, and move failures", async () => {
    vi.mocked(createChildPage).mockRejectedValueOnce(new Error("create failed"));
    vi.mocked(renamePage).mockRejectedValueOnce(new Error("rename failed"));
    vi.mocked(deletePage).mockRejectedValueOnce(new Error("delete failed"));
    await renderRoute();
    await screen.findByText("Article");

    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    fireEvent.change(screen.getByPlaceholderText("Untitled page"), {
      target: { value: "Broken page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create as concept" }));
    expect(await screen.findByText("create failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "More actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename title" }));
    fireEvent.change(screen.getByDisplayValue("Article"), { target: { value: "Broken rename" } });
    fireEvent.click(screen.getByRole("button", { name: "Save title" }));
    expect((await screen.findAllByText("rename failed")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "More actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    expect((await screen.findAllByText("delete failed")).length).toBeGreaterThan(0);
  });
});

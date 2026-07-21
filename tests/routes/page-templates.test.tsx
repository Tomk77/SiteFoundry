import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import {
  deletePageTemplate,
  loadPageTemplateWorkspace,
  savePageTemplate,
  setFallbackPageTemplate,
} from "@/lib/page-templates-data";
import type { PageTemplateDefinition } from "@/lib/page-templates";

const navigate = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
let search: { q?: string; template?: string } = {};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/page-templates-data", () => ({
  deletePageTemplate: vi.fn(),
  loadPageTemplateWorkspace: vi.fn(),
  savePageTemplate: vi.fn(),
  setFallbackPageTemplate: vi.fn(),
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
      <button onClick={() => onWorkspaceSelect?.({ siteId: "site-2", languageId: "language-2" })}>
        Switch workspace
      </button>
      {children}
    </div>
  ),
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

vi.mock("@/components/page-template-editor", () => ({
  PageTemplateEditor: ({
    initialTemplate,
    onBack,
    onSave,
  }: {
    initialTemplate: PageTemplateDefinition;
    onBack: () => void;
    onSave: (value: PageTemplateDefinition) => Promise<void>;
  }) => (
    <div>
      <h1>Editing {initialTemplate.name}</h1>
      <button onClick={onBack}>Back</button>
      <button onClick={() => void onSave({ ...initialTemplate, name: "Saved template" })}>
        Save editor
      </button>
    </div>
  ),
}));

const standard: PageTemplateDefinition = {
  id: "template-1",
  key: "standard-page",
  name: "Standard page",
  description: "A standard layout",
  icon: "ph-file",
  status: "published",
  fallback: true,
  defaults: { seoTitle: "", seoDescription: "" },
  preview: "/preview/standard-page",
  components: [{ type: "hero", values: { headline: "Title" } }],
  revisions: [],
  modifiedAt: "2026-07-15",
  usageCount: 4,
};

const article: PageTemplateDefinition = {
  ...standard,
  id: "template-2",
  key: "article",
  name: "Article",
  description: "Editorial content",
  fallback: false,
  usageCount: 2,
};

const draft: PageTemplateDefinition = {
  ...standard,
  id: "template-3",
  key: "draft-page",
  name: "Draft page",
  description: "Still being designed",
  status: "draft",
  fallback: false,
  usageCount: 0,
};

function workspace(templates = [standard, article, draft]) {
  return {
    site: { id: "site-1", name: "Site one", slug: "site-one" },
    language: { id: "language-1", code: "en", name: "English" },
    workspaces: [],
    templates,
    pageCount: 12,
  };
}

async function renderRoute() {
  const { Route } = await import("@/routes/page-templates");
  const Component = (Route as unknown as { component: React.ComponentType }).component;
  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  search = {};
  vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, loading: false } as never);
  vi.mocked(loadPageTemplateWorkspace).mockResolvedValue(workspace());
  vi.mocked(savePageTemplate).mockResolvedValue("template-1" as never);
  vi.mocked(deletePageTemplate).mockResolvedValue(undefined);
  vi.mocked(setFallbackPageTemplate).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("page templates route", () => {
  it("shows auth loading and redirects signed-out visitors", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    const view = await renderRoute();
    expect(screen.getByTestId("loading-splash")).toBeTruthy();
    view.unmount();

    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never);
    await renderRoute();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth" }));
  });

  it("loads, filters, opens, and switches a template workspace", async () => {
    await renderRoute();
    expect(await screen.findByRole("heading", { name: /Page templates/ })).toBeTruthy();
    expect(await screen.findByText("Standard page")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Search templates..."), {
      target: { value: "article" },
    });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { q: "article", template: undefined } }),
    );
    fireEvent.click(screen.getByText("Standard page").closest('[role="button"]')!);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { q: undefined, template: "standard-page" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch workspace" }));
    expect(loadPageTemplateWorkspace).toHaveBeenLastCalledWith({
      siteId: "site-2",
      languageId: "language-2",
    });
  });

  it("creates an empty template and reports save errors", async () => {
    await renderRoute();
    await screen.findByText("Standard page");
    fireEvent.click(screen.getByRole("button", { name: /New template/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change icon" }));
    fireEvent.change(screen.getByPlaceholderText("Standard page"), {
      target: { value: "Campaign page" },
    });
    fireEvent.change(screen.getByPlaceholderText("What should editors use this for?"), {
      target: { value: "Campaign content" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));
    await waitFor(() =>
      expect(savePageTemplate).toHaveBeenCalledWith({
        languageId: "language-1",
        template: expect.objectContaining({
          key: "campaign-page",
          name: "Campaign page",
          components: [],
        }),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Template created", expect.anything());

    vi.mocked(savePageTemplate).mockRejectedValueOnce(new Error("database failed"));
    fireEvent.click(screen.getByRole("button", { name: /New template/ }));
    fireEvent.change(screen.getByPlaceholderText("Standard page"), {
      target: { value: "Failure page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Could not create template", expect.anything()),
    );
  });

  it("duplicates and renames a template from its row menu", async () => {
    await renderRoute();
    await screen.findByText("Article");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(screen.getByDisplayValue("Article copy")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Duplicate existing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));
    await waitFor(() =>
      expect(savePageTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ key: "article-copy" }),
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByDisplayValue("Article"), { target: { value: "News article" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() =>
      expect(savePageTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ template: expect.objectContaining({ name: "News article" }) }),
      ),
    );
  });

  it("sets fallback, deletes independent templates, and blocks fallback deletion", async () => {
    await renderRoute();
    await screen.findByText("Article");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Article" }));
    fireEvent.click(screen.getByRole("button", { name: "Set as fallback" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace fallback" }));
    await waitFor(() =>
      expect(setFallbackPageTemplate).toHaveBeenCalledWith("language-1", "template-2"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for Draft page" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));
    await waitFor(() =>
      expect(deletePageTemplate).toHaveBeenCalledWith("language-1", "template-3"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for Standard page" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("heading", { name: "Choose another fallback first" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose fallback" }));
  });

  it("renders empty, error, no-match, and editor states", async () => {
    vi.mocked(loadPageTemplateWorkspace).mockResolvedValueOnce(null);
    let view = await renderRoute();
    expect(await screen.findByText("No templates for this site yet")).toBeTruthy();
    view.unmount();

    vi.mocked(loadPageTemplateWorkspace).mockRejectedValueOnce(new Error("offline"));
    view = await renderRoute();
    expect(await screen.findByText("Couldn't load page templates")).toBeTruthy();
    view.unmount();

    search = { q: "missing" };
    vi.mocked(loadPageTemplateWorkspace).mockResolvedValueOnce(workspace());
    view = await renderRoute();
    expect(await screen.findByText(/No templates match/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" }).at(-1)!);
    view.unmount();

    search = { template: "standard-page" };
    vi.mocked(loadPageTemplateWorkspace).mockResolvedValueOnce(workspace());
    await renderRoute();
    expect(await screen.findByRole("heading", { name: "Editing Standard page" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save editor" }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Template saved", expect.anything()),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
  });
});

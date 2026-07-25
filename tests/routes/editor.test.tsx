import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import { loadPageTemplates } from "@/lib/page-templates-data";
import {
  deleteEditablePage,
  discardEditablePageConcept,
  loadEditablePage,
  saveEditablePage,
  type EditablePage,
} from "@/lib/page-editor";

const navigate = vi.fn();
let pageId = "page-1";
let testNumber = 0;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => ({ page: pageId }),
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/page-editor", () => ({
  deleteEditablePage: vi.fn(),
  discardEditablePageConcept: vi.fn(),
  loadEditablePage: vi.fn(),
  pageFromRevision: (
    page: EditablePage,
    snapshot: NonNullable<EditablePage["publishedRevision"]>["snapshot"],
  ) => ({ ...page, ...snapshot }),
  saveEditablePage: vi.fn(),
}));
vi.mock("@/lib/page-templates-data", () => ({ loadPageTemplates: vi.fn() }));

vi.mock("@/components/loading", () => ({
  LoadingSplash: () => <div>Authentication loading</div>,
  RouteLoading: ({ title }: { title: string }) => <div>{title}</div>,
}));

const makePage = (): EditablePage => ({
  id: pageId,
  title: "Product launch",
  slug: "product-launch",
  path: "/news/product-launch",
  parentPath: "/news/",
  parentTitle: "News",
  breadcrumbs: ["Pages", "News", "Product launch"],
  templateName: "News article",
  templateKey: "news-article",
  status: "concept",
  validationStatus: "needs_attention",
  blocks: [
    {
      id: "hero-1",
      type: "hero",
      data: { eyebrow: "News", headline: "Launch", subheadline: "Today" },
    },
    { id: "rich-1", type: "richtext", data: { body: "First paragraph\n\nSecond paragraph" } },
    { id: "quote-1", type: "quote", data: { text: "A quote", cite: "A person" } },
    { id: "image-1", type: "image", data: { alt: "", caption: "Launch image" } },
    { id: "cta-1", type: "cta", data: { heading: "Start", button: "Join" } },
  ],
  seoTitle: "Product launch",
  seoDescription: "",
  socialImage: null,
  preferredChildTemplate: null,
  siteLanguageId: "language-1",
  language: { code: "en", name: "English" },
  siteName: "Acme",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
  conceptRevision: null,
  publishedRevision: null,
});

async function renderRoute() {
  const { Route } = await import("@/routes/editor");
  const Component = (Route as unknown as { component: React.ComponentType }).component;

  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  testNumber += 1;
  pageId = `editor-page-${testNumber}`;
  vi.mocked(useAuth).mockReturnValue({
    user: { id: "editor-user", email: "editor@example.com" },
    loading: false,
  } as never);
  vi.mocked(loadEditablePage).mockResolvedValue(makePage());
  vi.mocked(loadPageTemplates).mockResolvedValue([]);
  vi.mocked(saveEditablePage).mockResolvedValue({
    status: "published",
    validationStatus: "ready",
    updatedAt: "2026-07-15T12:00:00.000Z",
    conceptRevision: { id: "revision-2", version: 2, createdAt: "2026-07-15T12:00:00.000Z" },
    publishedRevisionId: "published-1",
    publishedRevisionVersion: 1,
    publishedAt: "2026-07-15T12:00:00.000Z",
  });
  vi.mocked(deleteEditablePage).mockResolvedValue(undefined);
  vi.mocked(discardEditablePageConcept).mockResolvedValue(makePage());
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: { escape: (value: string) => value },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

describe("page editor route", () => {
  it("shows authentication, page loading, missing, and error states", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    const auth = await renderRoute();
    expect(screen.getByText("Authentication loading")).toBeTruthy();
    auth.unmount();

    vi.mocked(useAuth).mockReturnValue({ user: { id: "user" }, loading: false } as never);
    let resolvePage: (page: EditablePage | null) => void = () => undefined;
    vi.mocked(loadEditablePage).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    const loading = await renderRoute();
    expect(screen.getByText("Loading your page editor")).toBeTruthy();
    resolvePage(makePage());
    expect(await screen.findByText("Save concept")).toBeTruthy();
    loading.unmount();

    pageId = `missing-${testNumber}`;
    vi.mocked(loadEditablePage).mockResolvedValueOnce(null);
    const missing = await renderRoute();
    expect(await screen.findByText("The page was not found.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to pages" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
    missing.unmount();

    pageId = `error-${testNumber}`;
    vi.mocked(loadEditablePage).mockRejectedValueOnce(new Error("database offline"));
    await renderRoute();
    expect(await screen.findByText("database offline")).toBeTruthy();
  });

  it("renders every block in the live preview and changes preview controls", async () => {
    const { container } = await renderRoute();
    expect(await screen.findByText("Product launch")).toBeTruthy();
    const preview = screen.getByTitle("Live page preview") as HTMLIFrameElement;
    expect(preview.srcdoc).toContain("Launch");
    expect(preview.srcdoc).toContain("First paragraph");
    expect(preview.srcdoc).toContain("A quote");
    expect(preview.srcdoc).toContain("Launch image");
    expect(preview.srcdoc).toContain("Start");

    fireEvent.click(screen.getByTitle("Mobile"));
    expect(preview.style.width).toBe("390px");
    fireEvent.click(screen.getByTitle("Refresh preview"));
    fireEvent.click(screen.getByTitle("Open preview"));
    expect(
      screen.getByText("Public preview will open when the frontend is connected"),
    ).toBeTruthy();
    expect(container.querySelector(".sc-editor-problems")?.textContent).toContain("2 problems");
  });

  it("edits SEO and page information", async () => {
    await renderRoute();
    await screen.findByText("Product launch");
    fireEvent.click(screen.getByRole("button", { name: /SEO/ }));
    expect(screen.getByText("2 to resolve before publishing")).toBeTruthy();
    fireEvent.change(document.querySelector("#seo-description")!, {
      target: { value: "A useful launch description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(screen.getByText("Media selection will be connected with uploading later")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Page information" }));
    const slug = screen.getByDisplayValue("product-launch");
    fireEvent.change(slug, { target: { value: "New Product!" } });
    expect(screen.getByDisplayValue("new-product-")).toBeTruthy();
    expect(screen.getByText(/Changing the slug updates this URL/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByText("Translation creation will be connected later")).toBeTruthy();
  });

  it("expands, edits, reorders, removes, and adds content blocks", async () => {
    await renderRoute();
    await screen.findByText("Product launch");
    fireEvent.change(screen.getByPlaceholderText("Headline"), { target: { value: "Updated" } });
    expect((screen.getByTitle("Live page preview") as HTMLIFrameElement).srcdoc).toContain(
      "Updated",
    );

    const moveDown = screen.getAllByTitle("Move down")[0]!;
    fireEvent.click(moveDown);
    fireEvent.click(screen.getAllByTitle("Remove block")[1]!);
    expect(screen.getByText(/Removed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add block" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Call to action/ }).at(-1)!);
    expect(screen.getAllByText("Call to action").length).toBeGreaterThan(0);
  });

  it("reacts to preview selection and ready messages", async () => {
    const { container } = await renderRoute();
    await screen.findByText("Product launch");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: "sc-preview", type: "select-field", id: "quote-1", fieldKey: "cite" },
      }),
    );
    await waitFor(() => expect(container.querySelector("[data-editor-field='cite']")).toBeTruthy());
    window.dispatchEvent(
      new MessageEvent("message", { data: { source: "sc-preview", type: "ready" } }),
    );
    window.dispatchEvent(new MessageEvent("message", { data: null }));
  });

  it("saves a concept, publishes, and reports save failures", async () => {
    await renderRoute();
    await screen.findByText("Product launch");
    fireEvent.click(screen.getByRole("button", { name: "Save concept" }));
    await waitFor(() => expect(saveEditablePage).toHaveBeenCalledWith(expect.anything(), false));
    expect(await screen.findByText("Concept saved")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(saveEditablePage).toHaveBeenCalledWith(expect.anything(), true));

    vi.mocked(saveEditablePage).mockRejectedValueOnce(new Error("save exploded"));
    fireEvent.click(screen.getByRole("button", { name: "Save concept" }));
    expect(await screen.findByText("save exploded")).toBeTruthy();
  });

  it("switches between the editable concept and read-only live version", async () => {
    const concept = makePage();
    concept.status = "published";
    concept.conceptRevision = {
      id: "concept-2",
      version: 2,
      createdAt: "2026-07-15T12:00:00.000Z",
    };
    concept.publishedRevision = {
      id: "published-1",
      version: 1,
      publishedAt: "2026-07-14T12:00:00.000Z",
      sourceConceptRevisionId: "concept-1",
      snapshot: {
        title: concept.title,
        slug: concept.slug,
        path: concept.path,
        blocks: [
          {
            id: "hero-1",
            type: "hero",
            data: { eyebrow: "News", headline: "Live headline", subheadline: "Today" },
          },
        ],
        seoTitle: concept.seoTitle,
        seoDescription: "Published description",
        socialImage: null,
        preferredChildTemplate: null,
        validationStatus: "ready",
      },
    };
    vi.mocked(loadEditablePage).mockResolvedValueOnce(concept);
    vi.mocked(discardEditablePageConcept).mockResolvedValueOnce({
      ...concept,
      blocks: concept.publishedRevision.snapshot.blocks,
      seoDescription: "Published description",
      conceptRevision: { ...concept.conceptRevision, id: "concept-1" },
    });

    await renderRoute();
    expect(await screen.findByText(/unpublished changes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View published" }));
    expect(screen.getByLabelText("Published page details (read-only)")).toBeTruthy();
    expect((screen.getByTitle("Live page preview") as HTMLIFrameElement).srcdoc).toContain(
      "Live headline",
    );
    expect(screen.getByRole("button", { name: "Save concept" }).hasAttribute("disabled")).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit concept" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard concept" }));
    await waitFor(() => expect(discardEditablePageConcept).toHaveBeenCalledWith(pageId));
  });

  it("deletes a page and reports deletion failures", async () => {
    await renderRoute();
    await screen.findByText("Product launch");
    fireEvent.click(screen.getByRole("button", { name: "Page information" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    await waitFor(() => expect(deleteEditablePage).toHaveBeenCalledWith(pageId));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });

    pageId = `delete-fail-${testNumber}`;
    vi.mocked(loadEditablePage).mockResolvedValueOnce(makePage());
    vi.mocked(deleteEditablePage).mockRejectedValueOnce(new Error("delete failed"));
    cleanup();
    await renderRoute();
    await screen.findByText("Product launch");
    fireEvent.click(screen.getByRole("button", { name: "Page information" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete page" }));
    expect(await screen.findByText("delete failed")).toBeTruthy();
  });
});

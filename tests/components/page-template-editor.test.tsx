import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import type { PageTemplateDefinition } from "@/lib/page-templates";
import { PageTemplateEditor } from "@/features/page-templates/page-template-editor";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn() },
}));

const template = (): PageTemplateDefinition => ({
  id: "template-1",
  key: "standard-page",
  name: "Standard page",
  description: "A reusable starting point.",
  icon: "ph-file",
  status: "published",
  fallback: false,
  defaults: { seoTitle: "Default SEO", seoDescription: "Default description" },
  preview: "/preview/standard",
  components: [
    {
      id: "hero-1",
      type: "hero",
      values: { headline: "Page title", eyebrow: "News", align: "Left", fullBleed: false },
    },
    { id: "rich-1", type: "richtext", values: { body: "Start writing here." } },
  ],
  revisions: [{ version: 1, note: "Initial template", at: "2026-07-12T10:00:00Z" }],
  modifiedAt: "2026-07-12T10:00:00Z",
  usageCount: 3,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

describe("PageTemplateEditor", () => {
  it("renders, changes preview device, and reports editor state", () => {
    const onBack = vi.fn();
    render(
      <PageTemplateEditor
        initialTemplate={template()}
        onBack={onBack}
        onSave={vi.fn()}
        saving={false}
        siteName="Acme"
      />,
    );
    expect(screen.getByText("Standard page")).toBeTruthy();
    expect(screen.getByText("Valid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "mobile" }));
    const preview = screen.getByTitle("Standard page preview") as HTMLIFrameElement;
    const previewStage = preview.parentElement;

    expect(preview.style.width).toBe("390px");
    expect(previewStage?.className).toContain("[flex:1]");
    expect(previewStage?.className).toContain("[&_iframe]:[height:100%]");
    fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to templates" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("edits, reorders, duplicates, removes, and adds components", () => {
    const { container } = render(
      <PageTemplateEditor
        initialTemplate={template()}
        onBack={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        siteName="Acme"
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Page title"), { target: { value: "New title" } });
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));

    fireEvent.click(container.querySelectorAll(".ph-arrow-down")[0]!.closest("button")!);
    fireEvent.click(container.querySelector(".ph-copy")!.closest("button")!);
    expect(container.querySelectorAll("[data-template-component]")).toHaveLength(3);
    fireEvent.click(container.querySelector(".ph-trash")!.closest("button")!);
    expect(container.querySelectorAll("[data-template-component]")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    const search = screen.getByPlaceholderText("Search components for this site...");
    fireEvent.change(search, { target: { value: "call to action" } });
    fireEvent.click(screen.getByRole("button", { name: /Call to action/ }));
    expect(container.querySelectorAll("[data-template-component]")).toHaveLength(3);
  });

  it("shows an empty catalogue result and adds a component to an empty template", () => {
    const empty = { ...template(), components: [] };
    render(
      <PageTemplateEditor
        initialTemplate={empty}
        onBack={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        siteName="Acme"
      />,
    );
    expect(screen.getByText("Empty template")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    fireEvent.change(screen.getByPlaceholderText("Search components for this site..."), {
      target: { value: "definitely missing" },
    });
    expect(screen.getByText("No registered components match this search.")).toBeTruthy();
  });

  it("edits settings and saves a valid template", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PageTemplateEditor
        initialTemplate={template()}
        onBack={vi.fn()}
        onSave={onSave}
        saving={false}
        siteName="Acme"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByDisplayValue("Standard page"), {
      target: { value: "Standard content page" },
    });
    fireEvent.change(screen.getByDisplayValue("A reusable starting point."), {
      target: { value: "Updated description" },
    });
    fireEvent.change(screen.getByDisplayValue("Default SEO"), {
      target: { value: "Updated SEO" },
    });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Standard content page", fallback: true }),
      ),
    );
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("blocks invalid saves and focuses the first problem", async () => {
    const invalid = template();
    invalid.components[0]!.values.headline = "";
    const onSave = vi.fn();
    render(
      <PageTemplateEditor
        initialTemplate={invalid}
        onBack={vi.fn()}
        onSave={onSave}
        saving={false}
        siteName="Acme"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    expect(toast.warning).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("opens JSON and responds to preview selection messages", async () => {
    const { container } = render(
      <PageTemplateEditor
        initialTemplate={template()}
        onBack={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        siteName="Acme"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "View JSON" }));
    expect(await screen.findByText("Template JSON")).toBeTruthy();
    expect(screen.getByText(/Database snapshot/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: "sc-template-preview", type: "select", id: "rich-1" },
      }),
    );
    await waitFor(() =>
      expect(container.querySelector("[data-template-component='rich-1']")?.className).toContain(
        "selected",
      ),
    );
    window.dispatchEvent(
      new MessageEvent("message", { data: { source: "sc-template-preview", type: "ready" } }),
    );
    window.dispatchEvent(new MessageEvent("message", { data: "ignored" }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../../test/supabase-mock";
import {
  deleteEditablePage,
  loadEditablePage,
  saveEditablePage,
  type EditablePage,
} from "./page-editor";
import { getSupabaseBrowserClient } from "./supabase";

vi.mock("./supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

const pageRow = {
  id: "page-1",
  title: "Product launch",
  slug: "product-launch",
  parent_id: "news",
  template_name: "News article",
  created_from_template_key: "news-article",
  status: "concept",
  validation_status: "needs_attention",
  content_blocks: [
    { id: "hero-1", type: "hero", data: { heading: "Launch" } },
    { id: "bad-1", type: "unknown", data: {} },
    null,
  ],
  seo_title: "Launch",
  seo_description: "Launch details",
  social_image: null,
  preferred_child_template: null,
  site_language_id: "language-1",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-02T00:00:00Z",
};

const editablePage: EditablePage = {
  id: "page-1",
  title: "Product launch",
  slug: "product-launch",
  path: "/news/product-launch",
  parentPath: "/news/",
  parentTitle: "News",
  breadcrumbs: ["Home", "News", "Product launch"],
  templateName: "News article",
  templateKey: "news-article",
  status: "concept",
  validationStatus: "needs_attention",
  blocks: [{ id: "image-1", type: "image", data: { alt: "Launch image" } }],
  seoTitle: "Launch",
  seoDescription: "Launch details",
  socialImage: null,
  preferredChildTemplate: null,
  siteLanguageId: "language-1",
  language: { code: "en", name: "English" },
  siteName: "Site one",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-02T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadEditablePage", () => {
  it("loads, filters, and maps a page with its full ancestry", async () => {
    const { client, calls } = createSupabaseMock({
      tables: {
        pages: [
          mockResult(pageRow),
          mockResult({
            id: "news",
            title: "News",
            slug: "news",
            parent_id: "home",
            is_homepage: false,
          }),
          mockResult({
            id: "home",
            title: "Home",
            slug: "home",
            parent_id: null,
            is_homepage: true,
          }),
        ],
        site_languages: [mockResult({ code: "en", name: "English", site_id: "site-1" })],
        sites: [mockResult({ name: "Site one" })],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(loadEditablePage("page-1")).resolves.toMatchObject({
      path: "/news/product-launch",
      parentPath: "/news/",
      parentTitle: "News",
      breadcrumbs: ["Home", "News", "Product launch"],
      blocks: [{ id: "hero-1", type: "hero", data: { heading: "Launch" } }],
      language: { code: "en", name: "English" },
      siteName: "Site one",
    });
    expect(calls).toContainEqual({ method: "eq", args: ["id", "page-1"] });
  });

  it("uses the demo slug when no page id is supplied", async () => {
    const { client, calls } = createSupabaseMock({ tables: { pages: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(loadEditablePage()).resolves.toBeNull();
    expect(calls).toContainEqual({ method: "eq", args: ["slug", "product-launch"] });
  });

  it("maps root pages and non-array content safely", async () => {
    const { client } = createSupabaseMock({
      tables: {
        pages: [mockResult({ ...pageRow, parent_id: null, slug: "", content_blocks: {} })],
        site_languages: [mockResult({ code: "en", name: "English", site_id: "site-1" })],
        sites: [mockResult({ name: "Site one" })],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(loadEditablePage("page-1")).resolves.toMatchObject({
      path: "/",
      parentPath: "/",
      parentTitle: null,
      breadcrumbs: ["Product launch"],
      blocks: [],
    });
  });

  it("surfaces page, language, site, and parent query failures", async () => {
    for (const tables of [
      {
        pages: [mockResult(null, new Error("page failed"))],
        site_languages: [],
        sites: [],
      },
      {
        pages: [mockResult(pageRow)],
        site_languages: [mockResult(null, new Error("language failed"))],
        sites: [],
      },
      {
        pages: [mockResult(pageRow)],
        site_languages: [mockResult({ code: "en", name: "English", site_id: "site-1" })],
        sites: [mockResult(null, new Error("site failed"))],
      },
      {
        pages: [mockResult(pageRow), mockResult(null, new Error("parent failed"))],
        site_languages: [mockResult({ code: "en", name: "English", site_id: "site-1" })],
        sites: [mockResult({ name: "Site one" })],
      },
    ]) {
      const { client } = createSupabaseMock({ tables });
      vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
      await expect(loadEditablePage("page-1")).rejects.toThrow("failed");
    }
  });
});

describe("editable page mutations", () => {
  it("publishes a valid page and returns persisted state", async () => {
    const { client, calls } = createSupabaseMock({
      tables: {
        pages: [
          mockResult({
            updated_at: "2026-07-15T00:00:00Z",
            status: "published",
            validation_status: "ready",
          }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(saveEditablePage(editablePage, true)).resolves.toEqual({
      updatedAt: "2026-07-15T00:00:00Z",
      status: "published",
      validationStatus: "ready",
    });
    expect(calls).toContainEqual({
      method: "update",
      args: [expect.objectContaining({ status: "published", validation_status: "ready" })],
    });
  });

  it("marks missing SEO and image alt text as needing attention", async () => {
    const { client, calls } = createSupabaseMock({
      tables: {
        pages: [
          mockResult({
            updated_at: "now",
            status: "concept",
            validation_status: "needs_attention",
          }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await saveEditablePage({
      ...editablePage,
      seoDescription: " ",
      blocks: [{ id: "image-1", type: "image", data: { alt: " " } }],
    });
    expect(calls).toContainEqual({
      method: "update",
      args: [expect.objectContaining({ status: "concept", validation_status: "needs_attention" })],
    });
  });

  it("surfaces save and delete failures", async () => {
    const { client } = createSupabaseMock({
      tables: {
        pages: [
          mockResult(null, new Error("save failed")),
          mockResult(null, new Error("delete failed")),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(saveEditablePage(editablePage)).rejects.toThrow("save failed");
    await expect(deleteEditablePage("page-1")).rejects.toThrow("delete failed");
  });

  it("deletes a page", async () => {
    const { client, calls } = createSupabaseMock({ tables: { pages: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(deleteEditablePage("page-1")).resolves.toBeUndefined();
    expect(calls).toContainEqual({ method: "delete", args: [] });
    expect(calls).toContainEqual({ method: "eq", args: ["id", "page-1"] });
  });

  it("rejects all operations without Supabase configuration", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    await expect(loadEditablePage("page-1")).rejects.toThrow("not configured");
    await expect(saveEditablePage(editablePage)).rejects.toThrow("not configured");
    await expect(deleteEditablePage("page-1")).rejects.toThrow("not configured");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import type { PageTemplateDefinition } from "@/lib/page-templates";
import {
  createChildPage,
  deletePage,
  loadPageTreeWorkspace,
  movePage,
  renamePage,
} from "@/lib/page-tree";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

const template: PageTemplateDefinition = {
  id: "template-1",
  siteLanguageId: "language-1",
  key: "standard-page",
  name: "Standard page",
  description: "Default structure",
  icon: "ph-file",
  status: "published",
  fallback: true,
  defaults: { seoTitle: "Default SEO", seoDescription: "Default description" },
  preview: "/preview/standard-page",
  components: [{ id: "component-1", type: "richtext", values: { body: "Start" } }],
  revisions: [],
};

const sites = [
  { id: "site-1", name: "Site one", slug: "one", updated_at: "2026-07-10T00:00:00Z" },
  { id: "site-2", name: "Site two", slug: "two", updated_at: "2026-07-11T00:00:00Z" },
];

const languages = [
  {
    id: "language-1",
    site_id: "site-1",
    code: "en",
    name: "English",
    is_default: true,
    position: 1,
    updated_at: "2026-07-12T00:00:00Z",
  },
  {
    id: "language-2",
    site_id: "site-2",
    code: "nl",
    name: "Nederlands",
    is_default: true,
    position: 0,
    updated_at: "2026-07-11T00:00:00Z",
  },
];

function pageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "home",
    parent_id: null,
    title: "Home",
    slug: "home",
    template_name: "Landing page",
    created_from_template_id: "template-home",
    created_from_template_key: "landing-page",
    status: "published",
    validation_status: "ready",
    position: 0,
    is_homepage: true,
    preferred_child_template: "standard-page",
    updated_at: "2026-07-13T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadPageTreeWorkspace", () => {
  it("builds ordered nested paths and workspace options", async () => {
    const { client } = createSupabaseMock({
      tables: {
        sites: [mockResult(sites)],
        site_languages: [mockResult(languages)],
        pages: [
          mockResult([
            pageRow(),
            pageRow({
              id: "z-child",
              parent_id: "home",
              title: "Zebra",
              slug: "zebra",
              template_name: "Standard page",
              created_from_template_id: null,
              created_from_template_key: "standard-page",
              status: "concept",
              validation_status: "needs_attention",
              position: 2,
              is_homepage: false,
              preferred_child_template: null,
            }),
            pageRow({
              id: "a-child",
              parent_id: "home",
              title: "About",
              slug: "about",
              template_name: "Standard page",
              position: 1,
              is_homepage: false,
              preferred_child_template: null,
              updated_at: "2026-07-15T00:00:00Z",
            }),
            pageRow({
              id: "team",
              parent_id: "a-child",
              title: "Team",
              slug: "team",
              position: 0,
              is_homepage: false,
              preferred_child_template: null,
            }),
          ]),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    const workspace = await loadPageTreeWorkspace({ siteId: "site-1", languageId: "language-1" });

    expect(workspace).toMatchObject({
      site: { id: "site-1", name: "Site one" },
      language: { id: "language-1", code: "en" },
      pageCount: 4,
      lastUpdatedAt: "2026-07-15T00:00:00Z",
    });
    expect(workspace?.pages[0]?.children.map((page) => page.title)).toEqual(["About", "Zebra"]);
    expect(workspace?.pages[0]?.children[0]?.children[0]?.slug).toBe("/about/team");
    expect(workspace?.pages[0]?.children[1]).toMatchObject({
      status: "Concept",
      validation: "Needs attention",
      templateId: null,
    });
    expect(workspace?.workspaces).toEqual([
      expect.objectContaining({ siteName: "Site one", languageCode: "en" }),
      expect.objectContaining({ siteName: "Site two", languageCode: "nl" }),
    ]);
  });

  it("returns null when sites or matching languages are absent", async () => {
    const noSites = createSupabaseMock({ tables: { sites: [mockResult([])] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(noSites.client as never);
    await expect(loadPageTreeWorkspace()).resolves.toBeNull();

    const noLanguages = createSupabaseMock({
      tables: { sites: [mockResult(sites)], site_languages: [mockResult([])] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(noLanguages.client as never);
    await expect(loadPageTreeWorkspace()).resolves.toBeNull();
  });

  it("rejects cyclic page trees and database failures", async () => {
    const cyclic = createSupabaseMock({
      tables: {
        sites: [mockResult(sites)],
        site_languages: [mockResult(languages)],
        pages: [
          mockResult([pageRow(), pageRow({ id: "home", parent_id: "home", is_homepage: false })]),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(cyclic.client as never);
    await expect(loadPageTreeWorkspace()).rejects.toThrow("contains a cycle");

    const failure = createSupabaseMock({
      tables: { sites: [mockResult(null, new Error("sites failed"))] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(failure.client as never);
    await expect(loadPageTreeWorkspace()).rejects.toThrow("sites failed");
  });
});

describe("page tree mutations", () => {
  it("creates a concept page from an independent template copy", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const { client, calls } = createSupabaseMock({
      tables: {
        pages: [mockResult([{ slug: "existing", position: 3 }]), mockResult({ id: "page-new" })],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(
      createChildPage({
        languageId: "language-1",
        parentId: "home",
        title: "  New Page  ",
        slug: "New URL",
        template,
      }),
    ).resolves.toBe("page-new");
    expect(calls).toContainEqual({
      method: "insert",
      args: [
        expect.objectContaining({
          title: "New Page",
          slug: "new-url",
          position: 4,
          created_from_template_id: "template-1",
          content_blocks: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              type: "richtext",
              data: { body: "Start" },
            },
          ],
        }),
      ],
    });
  });

  it("rejects duplicate child URLs and sibling query failures", async () => {
    const duplicate = createSupabaseMock({
      tables: { pages: [mockResult([{ slug: "new-page", position: 0 }])] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(duplicate.client as never);
    await expect(
      createChildPage({
        languageId: "language-1",
        parentId: "home",
        title: "New page",
        template,
      }),
    ).rejects.toThrow("already exists");

    const failure = createSupabaseMock({
      tables: { pages: [mockResult(null, new Error("siblings failed"))] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(failure.client as never);
    await expect(
      createChildPage({
        languageId: "language-1",
        parentId: "home",
        title: "New page",
        template,
      }),
    ).rejects.toThrow("siblings failed");
  });

  it("renames trimmed titles and rejects empty titles", async () => {
    const { client, calls } = createSupabaseMock({ tables: { pages: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    await expect(renamePage("page-1", "  Better title  ")).resolves.toBeUndefined();
    expect(calls).toContainEqual({ method: "update", args: [{ title: "Better title" }] });
    await expect(renamePage("page-1", "   ")).rejects.toThrow("title is required");
  });

  it("blocks homepage and parent deletion, then deletes a leaf", async () => {
    const homepage = createSupabaseMock({
      tables: { pages: [mockResult({ id: "home", title: "Home", is_homepage: true })] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(homepage.client as never);
    await expect(deletePage("home")).rejects.toThrow("homepage cannot be deleted");

    const parent = createSupabaseMock({
      tables: {
        pages: [
          mockResult({ id: "parent", title: "Parent", is_homepage: false }),
          { data: null, error: null, count: 2 },
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(parent.client as never);
    await expect(deletePage("parent")).rejects.toThrow("has child pages");

    const leaf = createSupabaseMock({
      tables: {
        pages: [
          mockResult({ id: "leaf", title: "Leaf", is_homepage: false }),
          { data: null, error: null, count: 0 },
          mockResult(null),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(leaf.client as never);
    await expect(deletePage("leaf")).resolves.toBeUndefined();
  });

  it("moves pages through the database function", async () => {
    const response = {
      reparented: true,
      parentTitle: "News",
      affectedPages: 3,
      publishedPages: 2,
      redirectsCreated: 2,
    };
    const { client } = createSupabaseMock({ rpc: { move_page: [mockResult(response)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    await expect(
      movePage({ pageId: "page-1", targetId: "news", position: "inside", createRedirects: true }),
    ).resolves.toEqual(response);
    expect(client.rpc).toHaveBeenCalledWith("move_page", {
      moving_page_id: "page-1",
      target_page_id: "news",
      drop_position: "inside",
      create_redirects: true,
    });
  });

  it("rejects mutations without a configured client", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    await expect(renamePage("page-1", "Title")).rejects.toThrow("not configured");
    await expect(
      movePage({ pageId: "page-1", targetId: "page-2", position: "after" }),
    ).rejects.toThrow("not configured");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../../test/supabase-mock";
import {
  deletePageTemplate,
  loadPageTemplates,
  loadPageTemplateWorkspace,
  savePageTemplate,
  setFallbackPageTemplate,
} from "./page-templates-data";
import type { PageTemplateDefinition } from "./page-templates";
import { getSupabaseBrowserClient } from "./supabase";

vi.mock("./supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

const sites = [
  { id: "site-1", name: "Site one", slug: "one", created_at: "2026-07-01" },
  { id: "site-2", name: "Site two", slug: "two", created_at: "2026-07-02" },
];
const languages = [
  {
    id: "language-secondary",
    site_id: "site-1",
    code: "nl",
    name: "Nederlands",
    is_default: false,
    position: 0,
  },
  {
    id: "language-default",
    site_id: "site-1",
    code: "en",
    name: "English",
    is_default: true,
    position: 1,
  },
  {
    id: "language-orphan",
    site_id: "missing-site",
    code: "fr",
    name: "Français",
    is_default: true,
    position: 0,
  },
];

const template: PageTemplateDefinition = {
  id: "template-1",
  siteLanguageId: "language-default",
  key: "standard-page",
  name: "Standard page",
  description: "Default structure",
  icon: "ph-file",
  status: "published",
  fallback: true,
  defaults: { seoTitle: "SEO", seoDescription: "Description" },
  preview: "/preview/standard-page",
  components: [{ id: "old-id", type: "hero", values: { heading: "Hello" } }],
  revisions: [],
};

const databaseTemplate = {
  id: "template-1",
  siteLanguageId: "language-default",
  key: "standard-page",
  name: "Standard page",
  description: "Default structure",
  icon: "ph-file",
  status: "published",
  fallback: true,
  defaults: { seoTitle: "SEO", seoDescription: "Description" },
  preview: "/preview/standard-page",
  components: [
    {
      type: "hero",
      values: { heading: "Hello", count: 2, enabled: true, tags: ["one"], object: {} },
    },
    null,
  ],
  revisions: [{ version: 2, note: "Updated", at: "2026-07-15" }, null],
  modifiedAt: "2026-07-15",
  usageCount: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");
});

describe("page template loading", () => {
  it("selects the requested workspace and normalizes its templates", async () => {
    const { client } = createSupabaseMock({
      tables: {
        sites: [mockResult(sites)],
        site_languages: [mockResult(languages)],
      },
      rpc: {
        get_page_template_workspace: [
          mockResult({ pageCount: "12", templates: [databaseTemplate] }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(
      loadPageTemplateWorkspace({ siteId: "site-1", languageId: "language-secondary" }),
    ).resolves.toMatchObject({
      site: { id: "site-1", name: "Site one", slug: "one" },
      language: { id: "language-secondary", code: "nl", name: "Nederlands" },
      pageCount: 12,
      templates: [
        {
          key: "standard-page",
          status: "published",
          usageCount: 4,
          components: [
            {
              id: "00000000-0000-4000-8000-000000000002",
              values: {
                heading: "Hello",
                count: 2,
                enabled: true,
                tags: ["one"],
                object: null,
              },
            },
          ],
          revisions: [{ version: 2, note: "Updated", at: "2026-07-15" }],
        },
      ],
    });
  });

  it("prefers a default language and labels orphan workspaces safely", async () => {
    const { client } = createSupabaseMock({
      tables: { sites: [mockResult(sites)], site_languages: [mockResult(languages)] },
      rpc: { get_page_template_workspace: [mockResult({})] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    const workspace = await loadPageTemplateWorkspace();
    expect(workspace?.language.id).toBe("language-default");
    expect(workspace?.workspaces.at(-1)?.siteName).toBe("Site");
    expect(workspace?.templates).toEqual([]);
    expect(workspace?.pageCount).toBe(0);
  });

  it("returns null when no site or matching language exists", async () => {
    const noSite = createSupabaseMock({
      tables: { sites: [mockResult([])], site_languages: [mockResult([])] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(noSite.client as never);
    await expect(loadPageTemplateWorkspace()).resolves.toBeNull();

    const noLanguage = createSupabaseMock({
      tables: { sites: [mockResult(sites)], site_languages: [mockResult([])] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(noLanguage.client as never);
    await expect(loadPageTemplateWorkspace()).resolves.toBeNull();
  });

  it("normalizes default values from a sparse database payload", async () => {
    const { client } = createSupabaseMock({
      rpc: {
        get_page_template_workspace: [
          mockResult({
            templates: [
              {
                key: "simple",
                defaults: null,
                components: "invalid",
                revisions: [{ version: 0 }],
              },
            ],
          }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    const [result] = await loadPageTemplates("language-default");
    expect(result).toMatchObject({
      key: "simple",
      name: "simple",
      description: "",
      icon: "ph-file",
      status: "draft",
      fallback: false,
      defaults: { seoTitle: "", seoDescription: "" },
      preview: "/preview/simple",
      components: [],
      revisions: [{ version: 1, note: "Template saved" }],
      usageCount: 0,
    });
    expect(result?.revisions[0]?.at).toEqual(expect.any(String));
  });

  it("rejects malformed templates and database failures", async () => {
    for (const value of [null, { key: "Bad key" }]) {
      const { client } = createSupabaseMock({
        rpc: { get_page_template_workspace: [mockResult({ templates: [value] })] },
      });
      vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
      await expect(loadPageTemplates("language-default")).rejects.toThrow();
    }

    const failed = createSupabaseMock({
      rpc: { get_page_template_workspace: [mockResult(null, new Error("template failed"))] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(failed.client as never);
    await expect(loadPageTemplates("language-default")).rejects.toThrow("template failed");
  });

  it("surfaces site and language query failures", async () => {
    for (const tables of [
      { sites: [mockResult(null, new Error("sites failed"))], site_languages: [mockResult([])] },
      {
        sites: [mockResult(sites)],
        site_languages: [mockResult(null, new Error("languages failed"))],
      },
    ]) {
      const { client } = createSupabaseMock({ tables });
      vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
      await expect(loadPageTemplateWorkspace()).rejects.toThrow("failed");
    }
  });
});

describe("page template mutations", () => {
  it("saves only persisted component data", async () => {
    const { client, calls } = createSupabaseMock({
      rpc: { save_page_template: [mockResult("template-1")] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(savePageTemplate({ languageId: "language-default", template })).resolves.toBe(
      "template-1",
    );
    expect(calls).toContainEqual({
      method: "rpc",
      args: [
        "save_page_template",
        expect.objectContaining({
          target_template_id: "template-1",
          target_key: "standard-page",
          target_components: [{ type: "hero", values: { heading: "Hello" } }],
        }),
      ],
    });
  });

  it("sets fallback and deletes templates", async () => {
    const { client, calls } = createSupabaseMock({
      rpc: {
        set_fallback_page_template: [mockResult(null)],
        delete_page_template: [mockResult(null)],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(
      setFallbackPageTemplate("language-default", "template-1"),
    ).resolves.toBeUndefined();
    await expect(deletePageTemplate("language-default", "template-1")).resolves.toBeUndefined();
    expect(calls.filter((call) => call.method === "rpc")).toHaveLength(2);
  });

  it("surfaces every mutation failure", async () => {
    const { client } = createSupabaseMock({
      rpc: {
        save_page_template: [mockResult(null, new Error("save failed"))],
        set_fallback_page_template: [mockResult(null, new Error("fallback failed"))],
        delete_page_template: [mockResult(null, new Error("delete failed"))],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(savePageTemplate({ languageId: "language-default", template })).rejects.toThrow(
      "save failed",
    );
    await expect(setFallbackPageTemplate("language-default", "template-1")).rejects.toThrow(
      "fallback failed",
    );
    await expect(deletePageTemplate("language-default", "template-1")).rejects.toThrow(
      "delete failed",
    );
  });

  it("rejects all operations without Supabase configuration", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    await expect(loadPageTemplates("language-default")).rejects.toThrow("not configured");
    await expect(loadPageTemplateWorkspace()).rejects.toThrow("not configured");
    await expect(savePageTemplate({ languageId: "language-default", template })).rejects.toThrow(
      "not configured",
    );
    await expect(setFallbackPageTemplate("language-default", "template-1")).rejects.toThrow(
      "not configured",
    );
    await expect(deletePageTemplate("language-default", "template-1")).rejects.toThrow(
      "not configured",
    );
  });
});

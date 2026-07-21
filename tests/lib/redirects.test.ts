import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import { loadPageTreeWorkspace, type PageTreeWorkspace } from "@/lib/page-tree";
import {
  deleteRedirect,
  getRedirectHealth,
  loadRedirectWorkspace,
  normalizeRedirectPath,
  saveRedirect,
  type RedirectRecord,
} from "@/lib/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/page-tree", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/page-tree")>();

  return { ...actual, loadPageTreeWorkspace: vi.fn() };
});

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

const workspace: PageTreeWorkspace = {
  site: { id: "site-1", name: "Site", slug: "site" },
  language: { id: "language-1", code: "en", name: "English" },
  workspaces: [],
  pageCount: 2,
  lastUpdatedAt: "2026-07-15T12:00:00.000Z",
  pages: [
    {
      id: "home",
      parentId: null,
      title: "Home",
      slug: "/",
      template: "Landing page",
      templateId: "template-1",
      templateKey: "landing-page",
      status: "Published",
      validation: "Ready",
      updatedAt: "2026-07-15T12:00:00.000Z",
      isHomepage: true,
      preferredChildTemplate: null,
      children: [
        {
          id: "about",
          parentId: "home",
          title: "About",
          slug: "/about",
          template: "Standard page",
          templateId: "template-2",
          templateKey: "standard-page",
          status: "Published",
          validation: "Ready",
          updatedAt: "2026-07-15T12:00:00.000Z",
          isHomepage: false,
          preferredChildTemplate: null,
          children: [],
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadPageTreeWorkspace).mockResolvedValue(workspace);
});

function redirect(sourcePath: string, destinationPath: string, id = sourcePath): RedirectRecord {
  return {
    id,
    siteLanguageId: "language-1",
    pageId: null,
    sourcePath,
    destinationPath,
    statusCode: 301,
    createdAt: "2026-07-13T00:00:00.000Z",
    pageTitle: null,
  };
}

describe("normalizeRedirectPath", () => {
  it("normalizes whitespace, slashes, and trailing separators", () => {
    expect(normalizeRedirectPath("  old//page/ ")).toBe("/old/page");
    expect(normalizeRedirectPath("/")).toBe("/");
    expect(normalizeRedirectPath("   ")).toBe("");
  });
});

describe("getRedirectHealth", () => {
  it("reports a missing live destination as broken", () => {
    const item = redirect("/old", "/missing");

    expect(getRedirectHealth(item, new Set(["/about"]), [item])?.kind).toBe("broken");
  });

  it("reports a redirect whose destination is another redirect as chained", () => {
    const first = redirect("/old", "/middle", "first");
    const second = redirect("/middle", "/about", "second");

    expect(getRedirectHealth(first, new Set(["/about"]), [first, second])?.kind).toBe("chained");
  });

  it("reports cycles as loops before reporting them as chains", () => {
    const first = redirect("/one", "/two", "first");
    const second = redirect("/two", "/one", "second");

    expect(getRedirectHealth(first, new Set<string>(), [first, second])?.kind).toBe("loop");
  });

  it("returns no warning for a direct redirect to a live page", () => {
    const item = redirect("/old", "/about");

    expect(getRedirectHealth(item, new Set(["/about"]), [item])).toBeNull();
  });
});

describe("redirect persistence", () => {
  it("returns null when the page workspace does not exist", async () => {
    vi.mocked(loadPageTreeWorkspace).mockResolvedValueOnce(null);
    await expect(loadRedirectWorkspace()).resolves.toBeNull();
  });

  it("maps redirects to live pages and normalizes status codes", async () => {
    const { client } = createSupabaseMock({
      tables: {
        redirects: [
          mockResult([
            {
              id: "redirect-1",
              site_language_id: "language-1",
              page_id: "about",
              source_path: "/company",
              destination_path: "/about",
              status_code: 302,
              created_at: "2026-07-15T12:00:00.000Z",
            },
            {
              id: "redirect-2",
              site_language_id: "language-1",
              page_id: "missing",
              source_path: "/old",
              destination_path: "/",
              status_code: 999,
              created_at: "2026-07-14T12:00:00.000Z",
            },
          ]),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    const result = await loadRedirectWorkspace();

    expect(result?.livePages).toHaveLength(2);
    expect(result?.redirects).toEqual([
      expect.objectContaining({ id: "redirect-1", statusCode: 302, pageTitle: "About" }),
      expect.objectContaining({ id: "redirect-2", statusCode: 301, pageTitle: null }),
    ]);
  });

  it("creates and updates normalized redirects", async () => {
    const { client, calls } = createSupabaseMock({
      tables: {
        redirects: [mockResult({ id: "redirect-new" }), mockResult(null)],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(
      saveRedirect({
        siteLanguageId: "language-1",
        sourcePath: " old//path/ ",
        destinationPath: "new/path/",
        statusCode: 301,
      }),
    ).resolves.toBe("redirect-new");
    await expect(
      saveRedirect({
        id: "redirect-1",
        siteLanguageId: "language-1",
        sourcePath: "/old",
        destinationPath: "/new",
        statusCode: 302,
      }),
    ).resolves.toBe("redirect-1");
    expect(calls).toContainEqual({
      method: "insert",
      args: [
        {
          source_path: "/old/path",
          destination_path: "/new/path",
          status_code: 301,
          site_language_id: "language-1",
          page_id: null,
        },
      ],
    });
  });

  it("deletes redirects and surfaces database failures", async () => {
    const databaseError = new Error("delete failed");
    const { client } = createSupabaseMock({
      tables: { redirects: [mockResult(null), mockResult(null, databaseError)] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(deleteRedirect("redirect-1")).resolves.toBeUndefined();
    await expect(deleteRedirect("redirect-2")).rejects.toBe(databaseError);
  });

  it("rejects persistence when Supabase is unavailable", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    await expect(deleteRedirect("redirect-1")).rejects.toThrow("not configured");
  });
});

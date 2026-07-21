import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import {
  createNavigationItem,
  loadNavigationWorkspace,
  publishNavigation,
  saveNavigationDraft,
  type NavigationItem,
} from "@/lib/navigation";
import { loadPageTreeWorkspace, type PageTreeWorkspace } from "@/lib/page-tree";
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

const item: NavigationItem = {
  id: "item-1",
  kind: "link",
  label: "About",
  target: "/about",
  targetType: "page",
  newTab: false,
  children: [],
};

beforeEach(() => {
  vi.mocked(loadPageTreeWorkspace).mockResolvedValue(workspace);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("createNavigationItem", () => {
  it("creates a page link with editable defaults", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("00000000-0000-4000-8000-000000000001");

    expect(createNavigationItem("link")).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      kind: "link",
      label: "New link",
      target: "/about",
      targetType: "page",
      newTab: false,
      children: [],
    });
  });

  it("creates a dropdown with one nested link and no deeper nesting", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000003");

    const group = createNavigationItem("group");

    expect(group.kind).toBe("group");
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({
      kind: "link",
      label: "First link",
      children: [],
    });
  });

  it("creates external buttons with an HTTPS target", () => {
    expect(createNavigationItem("button", "url")).toMatchObject({
      kind: "button",
      label: "New button",
      target: "https://",
      targetType: "url",
    });
  });
});

describe("navigation persistence", () => {
  it("returns null when no page workspace exists", async () => {
    vi.mocked(loadPageTreeWorkspace).mockResolvedValueOnce(null);
    await expect(loadNavigationWorkspace("header")).resolves.toBeNull();
  });

  it("loads valid items, drops malformed JSON, and flattens page options", async () => {
    const { client } = createSupabaseMock({
      tables: {
        navigation_menus: [
          mockResult({
            id: "menu-1",
            location: "header",
            draft_items: [item, { ...item, id: 7 }, null],
            published_items: [item],
            published_at: "2026-07-15T12:00:00.000Z",
          }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    const result = await loadNavigationWorkspace("header");

    expect(result).toMatchObject({ menuId: "menu-1", location: "header", items: [item] });
    expect(result?.pageOptions).toEqual([
      { id: "home", title: "Home", path: "/" },
      { id: "about", title: "About", path: "/about" },
    ]);
  });

  it("creates a missing menu with empty draft and published items", async () => {
    const { client } = createSupabaseMock({
      tables: {
        navigation_menus: [mockResult(null), mockResult({ id: "menu-new", published_at: null })],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(loadNavigationWorkspace("footer")).resolves.toMatchObject({
      menuId: "menu-new",
      location: "footer",
      items: [],
      publishedItems: [],
      publishedAt: null,
    });
  });

  it("saves a draft and publishes the same item payload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T14:00:00.000Z"));
    const { client, calls } = createSupabaseMock({
      tables: {
        navigation_menus: [
          mockResult({ updated_at: "draft-time" }),
          mockResult({ updated_at: "publish-time", published_at: "2026-07-15T14:00:00.000Z" }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(saveNavigationDraft("menu-1", [item])).resolves.toBe("draft-time");
    await expect(publishNavigation("menu-1", [item])).resolves.toEqual({
      updated_at: "publish-time",
      published_at: "2026-07-15T14:00:00.000Z",
    });
    expect(calls.filter((call) => call.method === "update")).toHaveLength(2);
    vi.useRealTimers();
  });

  it("surfaces configuration and database failures", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValueOnce(null);
    await expect(saveNavigationDraft("menu-1", [])).rejects.toThrow("not configured");

    const databaseError = new Error("write failed");
    const { client } = createSupabaseMock({
      tables: { navigation_menus: [mockResult(null, databaseError)] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    await expect(saveNavigationDraft("menu-1", [])).rejects.toBe(databaseError);
  });
});

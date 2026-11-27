import { describe, expect, it } from "vitest";

import {
  connection,
  InvalidCursorError,
  parseDeliveryBundle,
  resolvePage,
} from "@/domain/delivery";

const rawBundle = {
  site: {
    id: "site-1",
    key: "northstar",
    name: "Northstar",
    timezone: "Europe/Amsterdam",
    domains: [{ hostname: "northstar.example", primary: true }],
  },
  languages: [
    { id: "en", code: "en", name: "English", default: true, urlPrefix: "" },
    { id: "nl", code: "nl", name: "Dutch", default: false, urlPrefix: "nl" },
  ],
  pages: [
    {
      id: "page-en",
      languageId: "en",
      locale: "en",
      title: "About",
      slug: "about",
      path: "/about/",
      templateName: "Standard page",
      blocks: [
        { id: "hero", type: "hero", version: 1, data: { headline: "About us" } },
        {
          id: "faq",
          type: "faq",
          version: 1,
          data: { heading: "Questions", items: "Why? | Because." },
        },
      ],
      seo: { title: "About", description: "About Northstar", socialImage: null },
      revisionId: "revision-en",
      revisionVersion: 1,
      publishedAt: "2026-07-22T10:00:00Z",
      createdAt: "2026-07-20T10:00:00Z",
      updatedAt: "2026-07-22T10:00:00Z",
    },
    {
      id: "page-nl",
      languageId: "nl",
      locale: "nl",
      title: "Over ons",
      slug: "over-ons",
      path: "/over-ons",
      templateName: "Standard page",
      blocks: [],
      seo: { title: "Over ons", description: "", socialImage: null },
      revisionId: "revision-nl",
      revisionVersion: 1,
      publishedAt: "2026-07-22T10:00:00Z",
      createdAt: "2026-07-20T10:00:00Z",
      updatedAt: "2026-07-22T10:00:00Z",
    },
  ],
  contentTypes: [],
  navigation: [],
  redirects: [],
  media: [],
};

describe("delivery domain", () => {
  it("normalizes published pages and versioned blocks", () => {
    const bundle = parseDeliveryBundle(rawBundle);

    expect(bundle.pages[0]).toMatchObject({ path: "/about", revisionId: "revision-en" });
    expect(bundle.pages[0]?.blocks[0]).toEqual({
      id: "hero",
      type: "hero",
      version: 1,
      data: { headline: "About us" },
    });
    expect(bundle.pages[0]?.blocks[1]).toEqual({
      id: "faq",
      type: "faq",
      version: 1,
      data: { heading: "Questions", items: "Why? | Because." },
    });
  });

  it("resolves relative and verified absolute URLs with language prefixes", () => {
    const bundle = parseDeliveryBundle(rawBundle);

    expect(resolvePage(bundle, "/about")?.id).toBe("page-en");
    expect(resolvePage(bundle, "https://northstar.example/nl/over-ons?preview=false")?.id).toBe(
      "page-nl",
    );
    expect(resolvePage(bundle, "https://attacker.example/about")).toBeNull();
  });

  it("creates bounded cursor connections", () => {
    const first = connection(["a", "b", "c"], 2);
    const second = connection(["a", "b", "c"], 2, first.pageInfo.endCursor);

    expect(first).toMatchObject({ nodes: ["a", "b"], totalCount: 3 });
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(second).toMatchObject({ nodes: ["c"], totalCount: 3 });
    expect(second.pageInfo.hasNextPage).toBe(false);
  });

  it("rejects a cursor it did not issue instead of restarting at the first page", () => {
    expect(() => connection(["a"], 1, "not-a-cursor")).toThrow(InvalidCursorError);
    expect(() => connection(["a"], 1, btoa("-4"))).toThrow(InvalidCursorError);
  });
});

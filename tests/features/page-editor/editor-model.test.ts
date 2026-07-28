import { describe, expect, it } from "vitest";

import {
  blockDefinitions,
  countPageChanges,
  defaults,
  nextBlockId,
} from "@/features/page-editor/editor-model";
import type { EditablePage, PageRevisionSnapshot } from "@/lib/page-editor";

describe("page editor model", () => {
  it("describes every supported block and creates collision-free identifiers", () => {
    expect(Object.keys(blockDefinitions)).toEqual([
      "hero",
      "richtext",
      "quote",
      "image",
      "cta",
      "metrics",
      "steps",
      "feature",
      "pageList",
      "faq",
    ]);
    expect(Object.keys(defaults)).toEqual(Object.keys(blockDefinitions));
    expect(
      nextBlockId([
        { id: "block-3", type: "richtext", data: {} },
        { id: "block-2", type: "quote", data: {} },
      ]),
    ).toBe("block-4");
  });

  it("counts scalar, block, order, and removal differences from the published version", () => {
    const published: PageRevisionSnapshot = {
      title: "Page",
      slug: "page",
      path: "/page",
      blocks: [
        { id: "one", type: "hero", data: { headline: "Live" } },
        { id: "two", type: "richtext", data: { body: "Body" } },
      ],
      seoTitle: "Page",
      seoDescription: "Description",
      socialImage: null,
      preferredChildTemplate: null,
      validationStatus: "ready",
    };
    const page = {
      ...published,
      seoTitle: "New title",
      blocks: [published.blocks[1]],
    } as EditablePage;

    expect(countPageChanges(page, published)).toBe(3);
    expect(countPageChanges({ ...page, ...published }, published)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { blockDefinitions, defaults, nextBlockId } from "@/features/page-editor/editor-model";

describe("page editor model", () => {
  it("describes every supported block and creates collision-free identifiers", () => {
    expect(Object.keys(blockDefinitions)).toEqual(["hero", "richtext", "quote", "image", "cta"]);
    expect(Object.keys(defaults)).toEqual(Object.keys(blockDefinitions));
    expect(
      nextBlockId([
        { id: "block-3", type: "richtext", data: {} },
        { id: "block-2", type: "quote", data: {} },
      ]),
    ).toBe("block-4");
  });
});

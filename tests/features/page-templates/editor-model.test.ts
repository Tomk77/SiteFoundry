import { describe, expect, it } from "vitest";

import { moveToTarget } from "@/features/page-templates/editor-model";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
const ids = (list: { id?: string }[]) => list.map((item) => item.id);

describe("moveToTarget (7.10)", () => {
  it("places an item moved down after its target", () => {
    expect(ids(moveToTarget(items, "a", "b"))).toEqual(["b", "a", "c"]);
    expect(ids(moveToTarget(items, "a", "c"))).toEqual(["b", "c", "a"]);
  });

  it("places an item moved up before its target", () => {
    expect(ids(moveToTarget(items, "c", "a"))).toEqual(["c", "a", "b"]);
  });

  it("leaves the list alone for unknown ids or a drop on itself", () => {
    expect(moveToTarget(items, "missing", "a")).toBe(items);
    expect(moveToTarget(items, "a", "missing")).toBe(items);
    expect(moveToTarget(items, "a", "a")).toBe(items);
  });
});

import { describe, expect, it } from "vitest";

import { allItems, move, parentOf } from "@/features/navigation/editor-model";
import type { NavigationItem } from "@/lib/navigation";

const items: NavigationItem[] = [
  {
    id: "group",
    kind: "group",
    label: "Products",
    target: "",
    targetType: "page",
    newTab: false,
    children: [
      {
        id: "child",
        kind: "link",
        label: "Platform",
        target: "/platform",
        targetType: "page",
        newTab: false,
        children: [],
      },
    ],
  },
  {
    id: "about",
    kind: "link",
    label: "About",
    target: "/about",
    targetType: "page",
    newTab: false,
    children: [],
  },
];

describe("navigation editor model", () => {
  it("flattens, finds parents, and reorders without mutating the source", () => {
    expect(allItems(items).map((item) => item.id)).toEqual(["group", "child", "about"]);
    expect(parentOf(items, "child")?.id).toBe("group");
    expect(move(items, 0, 1).map((item) => item.id)).toEqual(["about", "group"]);
    expect(items.map((item) => item.id)).toEqual(["group", "about"]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { createNavigationItem } from "./navigation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNavigationItem", () => {
  it("creates a page link with editable defaults", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(
      "00000000-0000-4000-8000-000000000001",
    );

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
    const button = createNavigationItem("button", "url");

    expect(button).toMatchObject({
      kind: "button",
      label: "New button",
      target: "https://",
      targetType: "url",
    });
  });
});

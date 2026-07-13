import { describe, expect, it } from "vitest";

import {
  getRedirectHealth,
  normalizeRedirectPath,
  type RedirectRecord,
} from "./redirects";

function redirect(
  sourcePath: string,
  destinationPath: string,
  id = sourcePath,
): RedirectRecord {
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

    expect(getRedirectHealth(item, new Set(["/about"]), [item])?.kind).toBe(
      "broken",
    );
  });

  it("reports a redirect whose destination is another redirect as chained", () => {
    const first = redirect("/old", "/middle", "first");
    const second = redirect("/middle", "/about", "second");

    expect(
      getRedirectHealth(first, new Set(["/about"]), [first, second])?.kind,
    ).toBe("chained");
  });

  it("reports cycles as loops before reporting them as chains", () => {
    const first = redirect("/one", "/two", "first");
    const second = redirect("/two", "/one", "second");

    expect(
      getRedirectHealth(first, new Set<string>(), [first, second])?.kind,
    ).toBe("loop");
  });

  it("returns no warning for a direct redirect to a live page", () => {
    const item = redirect("/old", "/about");

    expect(getRedirectHealth(item, new Set(["/about"]), [item])).toBeNull();
  });
});

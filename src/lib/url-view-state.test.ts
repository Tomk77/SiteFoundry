import { describe, expect, it } from "vitest";

import {
  createMediaUrlSearch,
  createPageTreeUrlSearch,
  createRedirectsUrlSearch,
  parseMediaUrlSearch,
  parsePageTreeUrlSearch,
  parseRedirectsUrlSearch,
} from "./url-view-state";

describe("shareable URL view state", () => {
  it("parses valid page filters and ignores unsupported values", () => {
    expect(
      parsePageTreeUrlSearch({
        q: "launch",
        status: "published",
        validation: "nope",
        template: "news-article",
      }),
    ).toEqual({
      q: "launch",
      status: "published",
      validation: undefined,
      template: "news-article",
    });
  });

  it("omits default page and redirect values from generated URLs", () => {
    expect(
      createPageTreeUrlSearch({
        q: "",
        status: "all",
        validation: "all",
        template: "all",
      }),
    ).toEqual({
      q: undefined,
      status: undefined,
      validation: undefined,
      template: undefined,
    });
    expect(createRedirectsUrlSearch({ q: "old", filter: "manual" })).toEqual({
      q: "old",
      filter: "manual",
    });
    expect(parseRedirectsUrlSearch({ filter: "invalid" }).filter).toBe(undefined);
  });

  it("round-trips media search context without serializing defaults", () => {
    const search = createMediaUrlSearch({
      q: "logo",
      folder: "brand",
      view: "list",
    });

    expect(parseMediaUrlSearch(search)).toEqual(search);
    expect(createMediaUrlSearch({ q: "", folder: "root", view: "grid" })).toEqual({
      q: undefined,
      folder: undefined,
      view: undefined,
    });
  });
});

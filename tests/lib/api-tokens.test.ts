import { describe, expect, it } from "vitest";

import { normalizeAllowedOrigins } from "@/lib/api-tokens";

describe("API token origins", () => {
  it("normalizes and deduplicates origins", () => {
    expect(
      normalizeAllowedOrigins(
        "https://northstar.example, http://localhost:3000\nhttps://northstar.example",
      ),
    ).toEqual(["https://northstar.example", "http://localhost:3000"]);
  });

  it("rejects URLs with paths", () => {
    expect(() => normalizeAllowedOrigins("https://northstar.example/path")).toThrow(
      "Use an origin without a path",
    );
  });
});

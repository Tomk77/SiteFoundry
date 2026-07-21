import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combines conditional classes and resolves Tailwind conflicts", () => {
    const hidden = false;
    expect(cn("px-2", hidden ? "hidden" : undefined, ["font-medium", "px-4"])).toBe(
      "font-medium px-4",
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import { ensureIds, withoutComponentId } from "@/features/page-templates/editor-model";
import type { PageTemplateDefinition } from "@/lib/page-templates";

describe("page template editor model", () => {
  it("creates editable component copies and removes editor-only identifiers", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const template: PageTemplateDefinition = {
      key: "landing",
      name: "Landing page",
      description: "",
      icon: "ph-file",
      status: "draft",
      fallback: false,
      defaults: { seoTitle: "", seoDescription: "" },
      preview: "",
      components: [{ id: "", type: "hero", values: { headline: "Hello" } }],
      revisions: [],
    };

    const editable = ensureIds(template);
    expect(editable.components[0]?.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(editable.components[0]?.values).not.toBe(template.components[0]?.values);
    expect(withoutComponentId(editable.components[0]!)).toEqual({
      type: "hero",
      values: { headline: "Hello" },
    });
  });
});

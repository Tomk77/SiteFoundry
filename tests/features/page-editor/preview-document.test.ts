import { describe, expect, it } from "vitest";

import { previewDocument } from "@/features/page-editor/preview-document";

describe("page editor preview document", () => {
  it("escapes content and includes the editor preview bridge", () => {
    const document = previewDocument([
      {
        id: "hero-1",
        type: "hero",
        data: { headline: '<script>alert("no")</script>' },
      },
    ]);

    expect(document).toContain("&lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;");
    expect(document).not.toContain('<script>alert("no")</script>');
    expect(document).toContain("sf-preview");
    expect(document).toContain("restore-scroll");
  });
});

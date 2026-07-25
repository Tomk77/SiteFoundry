import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("administration styling contract", () => {
  it("keeps Tailwind CSS 4 and the semantic theme wired through the root stylesheet", () => {
    const styles = source("src/styles.css");

    expect(styles).toContain('@import "tailwindcss";');
    expect(styles).toContain("@theme inline");
    expect(styles).toContain("--color-canvas: var(--sc-canvas)");
    expect(styles).toContain("--color-action: var(--sc-accent)");
    expect(styles).toContain("--color-published: var(--sc-published)");
  });

  it("keeps shared UI primitives on semantic utilities instead of palette literals", () => {
    const primitives = [
      "button.tsx",
      "dialog.tsx",
      "input.tsx",
      "native-select.tsx",
      "select.tsx",
      "switch.tsx",
      "textarea.tsx",
    ].map((file) => source(`src/components/ui/${file}`));

    for (const primitive of primitives) {
      expect(primitive).not.toMatch(/var\(--sc-/);
      expect(primitive).not.toMatch(/#[\da-f]{3,8}/i);
    }
  });

  it("keeps feature screens on Tailwind instead of route-owned stylesheets", () => {
    const removedFeatureStylesheets = [
      "editor.css",
      "media.css",
      "navigation.css",
      "overview.css",
      "page-templates.css",
      "personal-settings.css",
      "redirects.css",
      "settings.css",
      "structured-content.css",
      "components/ui/sonner.css",
    ];

    for (const stylesheet of removedFeatureStylesheets) {
      expect(existsSync(resolve(root, "src", stylesheet))).toBe(false);
    }

    const featureOwners = [
      "src/features/navigation/navigation-editor.tsx",
      "src/features/page-templates/page-template-editor.tsx",
      "src/features/page-templates/template-field-editor.tsx",
      "src/components/ui/sonner.tsx",
      "src/routes/auth.tsx",
      "src/routes/editor.tsx",
      "src/routes/index.tsx",
      "src/routes/media.tsx",
      "src/routes/page-templates.tsx",
      "src/routes/personal-settings.tsx",
      "src/routes/redirects.tsx",
      "src/routes/structured-content.tsx",
    ].map(source);

    for (const owner of featureOwners) {
      expect(owner).not.toMatch(/import\s+["'][^"']+\.css["']/);
      expect(owner).not.toContain("--ps-");
    }

    expect(source("src/styles.css")).not.toMatch(/^\s*\.sc-/m);
  });
});

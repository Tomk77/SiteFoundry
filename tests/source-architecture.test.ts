import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve("src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);

    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(entry)
        ? [path]
        : [];
  });
}

function sourcePath(path: string) {
  return relative(sourceRoot, path).split(sep).join("/");
}

function logicalLineCount(path: string) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
}

const legacyReactBaselines: Record<string, number> = {
  "features/media/media-screen.tsx": 690,
  "features/navigation/navigation-editor.tsx": 571,
  "features/page-templates/page-template-editor.tsx": 705,
  "features/page-templates/page-templates-screen.tsx": 836,
  "features/page-tree/page-tree-screen.tsx": 1384,
  "features/personal-settings/personal-settings-screen.tsx": 574,
  "features/redirects/redirects-screen.tsx": 652,
  "features/structured-content/structured-content-screen.tsx": 1062,
};

describe("source architecture", () => {
  const files = sourceFiles(sourceRoot);

  it("keeps routes thin and prevents legacy routes from growing", () => {
    const failures = files
      .filter((path) => sourcePath(path).startsWith("routes/"))
      .flatMap((path) => {
        const name = sourcePath(path);
        const maximum = 150;
        const lines = logicalLineCount(path);

        return lines > maximum ? [`${name}: ${lines} non-empty lines (maximum ${maximum})`] : [];
      });

    expect(failures).toEqual([]);
  });

  it("keeps new React modules focused and prevents legacy components from growing", () => {
    const failures = files
      .filter((path) => /\.tsx$/.test(path) && !sourcePath(path).startsWith("routes/"))
      .flatMap((path) => {
        const name = sourcePath(path);
        const maximum = legacyReactBaselines[name] ?? 350;
        const lines = logicalLineCount(path);

        return lines > maximum ? [`${name}: ${lines} non-empty lines (maximum ${maximum})`] : [];
      });

    expect(failures).toEqual([]);
  });

  it("keeps framework and persistence dependencies out of protected boundaries", () => {
    const failures = files.flatMap((path) => {
      const name = sourcePath(path);
      const source = readFileSync(path, "utf8");
      const messages: string[] = [];

      if (name.startsWith("routes/") && /(?:@supabase|lib\/supabase)/.test(source)) {
        messages.push(`${name} imports Supabase directly`);
      }

      if (name.startsWith("routes/") && /@\/features\/[^/"']+\//.test(source)) {
        messages.push(`${name} bypasses a feature public entry point`);
      }

      if (
        name.startsWith("domain/") &&
        /(?:from ["'](?:react|@tanstack|@supabase)|features\/)/.test(source)
      ) {
        messages.push(`${name} imports a framework, persistence client, or administration feature`);
      }

      if (name.startsWith("components/ui/") && /features\//.test(source)) {
        messages.push(`${name} imports feature code`);
      }

      if (name.startsWith("features/")) {
        const owner = name.split("/")[1];
        for (const match of source.matchAll(/@\/features\/([^/"']+)\/[^"']+/g)) {
          if (match[1] !== owner) messages.push(`${name} imports internals from ${match[1]}`);
        }
      }

      return messages;
    });

    expect(failures).toEqual([]);
  });
});

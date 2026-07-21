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

function lineCount(path: string) {
  return readFileSync(path, "utf8").split(/\r?\n/).length;
}

const legacyRouteBaselines: Record<string, number> = {
  "routes/auth.tsx": 319,
  "routes/index.tsx": 1418,
  "routes/media.tsx": 701,
  "routes/page-templates.tsx": 854,
  "routes/personal-settings.tsx": 604,
  "routes/redirects.tsx": 680,
  "routes/structured-content.tsx": 1103,
};

const legacyReactBaselines: Record<string, number> = {
  "components/navigation-editor.tsx": 1192,
  "components/page-template-editor.tsx": 733,
};

describe("source architecture", () => {
  const files = sourceFiles(sourceRoot);

  it("keeps routes thin and prevents legacy routes from growing", () => {
    const failures = files
      .filter((path) => sourcePath(path).startsWith("routes/"))
      .flatMap((path) => {
        const name = sourcePath(path);
        const maximum = legacyRouteBaselines[name] ?? 150;
        const lines = lineCount(path);
        return lines > maximum ? [`${name}: ${lines} lines (maximum ${maximum})`] : [];
      });

    expect(failures).toEqual([]);
  });

  it("keeps new React modules focused and prevents legacy components from growing", () => {
    const failures = files
      .filter((path) => /\.tsx$/.test(path) && !sourcePath(path).startsWith("routes/"))
      .flatMap((path) => {
        const name = sourcePath(path);
        const maximum = legacyReactBaselines[name] ?? 350;
        const lines = lineCount(path);
        return lines > maximum ? [`${name}: ${lines} lines (maximum ${maximum})`] : [];
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

      if (
        name.startsWith("domain/") &&
        /(?:from ["'](?:react|@tanstack|@supabase)|features\/)/.test(source)
      ) {
        messages.push(`${name} imports a framework, persistence client, or administration feature`);
      }

      if (name.startsWith("components/ui/") && /features\//.test(source)) {
        messages.push(`${name} imports feature code`);
      }

      return messages;
    });

    expect(failures).toEqual([]);
  });
});

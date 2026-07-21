import { readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(root, "src");

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("test layout", () => {
  it("keeps test files in the top-level tests directory", () => {
    const colocatedTests = filesUnder(sourceRoot)
      .filter((path) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(path))
      .map((path) => relative(root, path));

    expect(colocatedTests).toEqual([]);
  });
});

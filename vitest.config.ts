import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/lib/database.types.ts", "src/routeTree.gen.ts"],
      thresholds: {
        statements: 84,
        branches: 77,
        functions: 80,
        lines: 88,
      },
    },
  },
});

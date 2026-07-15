import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createRootRoute: (options: Record<string, unknown>) => options,
  HeadContent: () => <meta name="test-head" />,
  Scripts: () => <script data-test-scripts />,
}));
vi.mock("../lib/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-auth>{children}</div>,
}));
vi.mock("../components/ui/sonner", () => ({
  SiteFoundryToaster: () => <div data-toaster />,
}));

describe("root route", () => {
  it("defines document metadata, styles, theme bootstrap, and providers", async () => {
    const { Route } = await import("./__root");
    const root = Route as unknown as {
      head: () => { meta: Record<string, string>[]; links: Record<string, string>[] };
      shellComponent: React.ComponentType<{ children: React.ReactNode }>;
    };
    const head = root.head();
    expect(head.meta).toContainEqual({ title: "SiteFoundry" });
    expect(head.links).toHaveLength(4);

    const Shell = root.shellComponent;
    const html = renderToStaticMarkup(
      <Shell>
        <main>Page content</main>
      </Shell>,
    );
    expect(html).toContain('lang="en"');
    expect(html).toContain("sf-interface-mode");
    expect(html).toContain("data-auth");
    expect(html).toContain("data-toaster");
    expect(html).toContain("Page content");
  });
});

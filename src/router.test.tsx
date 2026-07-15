import { describe, expect, it, vi } from "vitest";

const createRouter = vi.fn((options: Record<string, unknown>) => ({ options }));

vi.mock("@tanstack/react-router", () => ({ createRouter }));
vi.mock("./routeTree.gen", () => ({ routeTree: { id: "route-tree" } }));
vi.mock("./components/loading", () => ({ LoadingSplash: () => null }));

describe("getRouter", () => {
  it("creates the application router with preload and loading defaults", async () => {
    const { getRouter } = await import("./router");
    const router = getRouter();
    expect(router).toEqual({ options: expect.any(Object) });
    expect(createRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        routeTree: { id: "route-tree" },
        scrollRestoration: true,
        defaultPreload: "intent",
        defaultPreloadStaleTime: 0,
        defaultPendingComponent: expect.any(Function),
      }),
    );
  });
});

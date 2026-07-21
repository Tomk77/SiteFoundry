import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children, active }: { children: React.ReactNode; active: string }) => (
    <div data-active={active}>{children}</div>
  ),
}));

vi.mock("@/components/navigation-editor", () => ({
  NavigationEditor: ({ location }: { location: string }) => <div>Navigation {location}</div>,
}));

afterEach(cleanup);

function component(route: unknown) {
  return (route as { component: React.ComponentType }).component;
}

describe("simple routes", () => {
  it("renders the header and footer navigation editors", async () => {
    const header = await import("@/routes/header-navigation");
    const Header = component(header.Route);
    render(<Header />);
    expect(screen.getByText("Navigation header")).toBeTruthy();
    cleanup();

    const footer = await import("@/routes/footer");
    const Footer = component(footer.Route);
    render(<Footer />);
    expect(screen.getByText("Navigation footer")).toBeTruthy();
  });

  it("keeps site settings separate from templates and personal settings", async () => {
    const settings = await import("@/routes/settings");
    const Settings = component(settings.Route);
    const view = render(<Settings />);
    expect(screen.getByRole("heading", { name: "Site settings" })).toBeTruthy();
    expect(screen.getByText(/separate from page templates/)).toBeTruthy();
    expect(view.container.firstElementChild?.getAttribute("data-active")).toBe("settings");
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
let search: { q?: string; folder?: string; view?: "grid" | "list" } = {};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

async function renderMedia() {
  const { Route } = await import("@/routes/media");
  const Component = (Route as unknown as { component: React.ComponentType }).component;

  return render(<Component />);
}

beforeEach(() => {
  vi.clearAllMocks();
  search = {};
});

afterEach(cleanup);

describe("media route", () => {
  it("renders seeded media and keeps search, folders, and view in the URL", async () => {
    const view = await renderMedia();
    expect(screen.getByRole("heading", { name: "Media" })).toBeTruthy();
    expect(screen.getByText("Folders")).toBeTruthy();
    expect(screen.getByText("Files")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search files..."), {
      target: { value: "hero" },
    });
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/media",
      search: { q: "hero" },
      replace: true,
      resetScroll: false,
    });

    fireEvent.click(view.container.querySelectorAll(".sf-view-toggle button")[1]!);
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { view: "list" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Brand/ }));
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { folder: "brand" } }),
    );
  });

  it("creates and renames a folder", async () => {
    await renderMedia();
    fireEvent.click(screen.getByRole("button", { name: /New folder/ }));
    const input = screen.getByDisplayValue("Untitled folder");
    fireEvent.change(input, { target: { value: "Campaign" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Campaign")).toBeTruthy();
  });

  it("edits, moves, copies, and deletes a selected image", async () => {
    await renderMedia();
    fireEvent.click(screen.getByRole("button", { name: /hero-home/ }));
    expect(screen.getByText("File details")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("hero-home"), { target: { value: "new-hero" } });
    expect(screen.getByDisplayValue("new-hero")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Describe this image for accessibility"), {
      target: { value: "A launch hero" },
    });
    expect(screen.queryByText(/Add alternative text/)).toBeNull();

    fireEvent.change(document.querySelector(".sf-detail-field select")!, {
      target: { value: "brand" },
    });
    expect(screen.getByText("File moved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Copy URL/ }));
    expect(screen.getByText("URL copied")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(screen.getByText("Download will be connected later")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Delete file/ }));
    expect(screen.queryByText("File details")).toBeNull();
    expect(screen.getByText("File deleted")).toBeTruthy();
  });

  it("opens and closes the upload flow", async () => {
    const view = await renderMedia();
    fireEvent.click(screen.getByRole("button", { name: /^Upload$/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose files" }));
    expect(screen.getByText("File selection will be connected with uploading")).toBeTruthy();
    fireEvent.mouseDown(view.container.querySelector(".sf-modal-backdrop")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders list, empty search, document, and nested-folder states", async () => {
    search = { folder: "brand", view: "list" };
    let view = await renderMedia();
    expect(view.container.querySelector(".sf-file-list")).toBeTruthy();
    expect(screen.getByText("Document")).toBeTruthy();
    cleanup();

    search = { q: "does-not-exist" };
    view = await renderMedia();
    expect(screen.getByRole("heading", { name: "No matches in this folder" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload images" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    cleanup();

    search = { folder: "brand" };
    await renderMedia();
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getAllByText("Media").length).toBeGreaterThan(0);
  });
});

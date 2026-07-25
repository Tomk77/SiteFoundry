import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import {
  deleteStructuredRecord,
  deleteStructuredType,
  loadStructuredContentWorkspace,
  saveStructuredRecord,
  saveStructuredType,
  type StructuredContentWorkspace,
} from "@/lib/structured-content-data";
import type { StructuredRecord, StructuredType } from "@/lib/structured-content";

const navigate = vi.fn();
let search: { q?: string; status?: "published" | "concept"; type?: string } = {};
let userNumber = 0;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/lib/auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/structured-content-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/structured-content-data")>()),
  deleteStructuredRecord: vi.fn(),
  deleteStructuredType: vi.fn(),
  loadStructuredContentWorkspace: vi.fn(),
  saveStructuredRecord: vi.fn(),
  saveStructuredType: vi.fn(),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StatusPill: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/components/loading", () => ({
  AppShellSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
  LoadingSplash: () => <div>Auth loading</div>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

const record: StructuredRecord = {
  id: "record-1",
  status: "published",
  updated: "2 days ago",
  values: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    skills: ["Engineering"],
    featured: true,
    bio: "First programmer",
  },
};

const colleagues: StructuredType = {
  id: "colleagues",
  slug: "colleagues",
  name: "Colleagues",
  singular: "colleague",
  icon: "ph-users",
  chipBg: "#eee",
  chipFg: "#333",
  description: "People shown across the site.",
  fields: [
    { id: "name", key: "name", label: "Full name", type: "text", primary: true, required: true },
    { id: "email", key: "email", label: "Email", type: "email" },
    { id: "skills", key: "skills", label: "Skills", type: "tags" },
    { id: "featured", key: "featured", label: "Featured", type: "toggle" },
    { id: "bio", key: "bio", label: "Biography", type: "rich" },
  ],
  records: [record],
};

const locations: StructuredType = {
  ...colleagues,
  id: "locations",
  slug: "locations",
  name: "Locations",
  singular: "location",
  records: [],
};

const workspace: StructuredContentWorkspace = {
  site: { id: "site-1", name: "Site one" },
  language: { id: "lang-1", name: "English", code: "en" },
  types: [colleagues, locations],
};

async function renderRoute() {
  const { Route } = await import("@/routes/structured-content");
  const Component = (Route as unknown as { component: React.ComponentType }).component;

  return render(<Component />);
}

function getFieldControl(label: string) {
  const field = Array.from(document.querySelectorAll("label.sc-record-field")).find((element) =>
    element.textContent?.includes(label),
  );
  const control = field?.querySelector("input, textarea");
  if (!control) throw new Error(`No control found for ${label}`);

  return control;
}

beforeEach(() => {
  vi.clearAllMocks();
  search = {};
  userNumber += 1;
  vi.mocked(useAuth).mockReturnValue({
    user: { id: `structured-user-${userNumber}` },
    loading: false,
  } as never);
  vi.mocked(loadStructuredContentWorkspace).mockResolvedValue(workspace);
  vi.mocked(saveStructuredRecord).mockImplementation(async (input) => ({
    id: input.id ?? "record-new",
    status: input.status,
    updated: "Just now",
    values: input.values,
  }));
  vi.mocked(deleteStructuredRecord).mockResolvedValue(undefined);
  vi.mocked(saveStructuredType).mockResolvedValue("type-1");
  vi.mocked(deleteStructuredType).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("structured content route", () => {
  it("shows authentication, workspace loading, and failure states", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    const auth = await renderRoute();
    expect(screen.getByText("Auth loading")).toBeTruthy();
    auth.unmount();

    vi.mocked(useAuth).mockReturnValue({ user: { id: "pending" }, loading: false } as never);
    let resolveWorkspace: (value: StructuredContentWorkspace) => void = () => undefined;
    vi.mocked(loadStructuredContentWorkspace).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );
    const loading = await renderRoute();
    expect(screen.getByText("Loading structured content")).toBeTruthy();
    resolveWorkspace(workspace);
    expect(await screen.findByRole("heading", { name: "Colleagues" })).toBeTruthy();
    loading.unmount();

    vi.mocked(loadStructuredContentWorkspace).mockRejectedValueOnce(new Error("offline"));
    await renderRoute();
    expect(await screen.findByText("offline")).toBeTruthy();
  });

  it("lists, searches, filters, and switches structured content types", async () => {
    await renderRoute();
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search Colleagues"), {
      target: { value: "Ada" },
    });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ q: "Ada" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Concept/ }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ status: "concept" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Locations/ }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { type: "locations" } }),
    );
  });

  it("creates a structured item with tags and publishing state", async () => {
    await renderRoute();
    await screen.findByText("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "New colleague" }));
    expect(screen.getAllByText("New colleague")).toHaveLength(2);
    fireEvent.change(getFieldControl("Full name"), { target: { value: "Grace Hopper" } });
    fireEvent.change(screen.getByPlaceholderText("Add tag and press Enter"), {
      target: { value: "Compilers" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Add tag and press Enter"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Published" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(saveStructuredRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          contentTypeId: "colleagues",
          languageId: "lang-1",
          status: "published",
          values: expect.objectContaining({ name: "Grace Hopper", skills: ["Compilers"] }),
        }),
      ),
    );
    expect(await screen.findByText("Structured item created")).toBeTruthy();
  });

  it("edits and deletes an existing item", async () => {
    await renderRoute();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Ada Lovelace" }));
    expect(screen.getByText("Edit colleague")).toBeTruthy();
    fireEvent.change(getFieldControl("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(saveStructuredRecord).toHaveBeenCalledWith(
        expect.objectContaining({ id: "record-1" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Ada Lovelace" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete item" }));
    await waitFor(() => expect(deleteStructuredRecord).toHaveBeenCalledWith("record-1"));
    expect(await screen.findByText("Structured item deleted")).toBeTruthy();
  });

  it("creates a custom content type with normalized fields", async () => {
    await renderRoute();
    await screen.findByText("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "New content type" }));
    expect(screen.getByRole("heading", { name: "New content type" })).toBeTruthy();
    fireEvent.change(document.querySelector("#content-type-name")!, {
      target: { value: "Partners" },
    });
    fireEvent.change(document.querySelector("#content-type-singular")!, {
      target: { value: "partner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ph-handshake" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const names = screen.getAllByPlaceholderText("Field name");
    fireEvent.change(names[1]!, { target: { value: "Website URL" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Set as primary field" })[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Create type" }));
    await waitFor(() =>
      expect(saveStructuredType).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Partners",
          singular: "partner",
          slug: "partners",
          icon: "ph-handshake",
          fields: expect.arrayContaining([
            expect.objectContaining({ label: "Website URL", key: "websiteUrl", primary: true }),
          ]),
        }),
      ),
    );
    expect(await screen.findByText("Content type created")).toBeTruthy();
  });

  it("configures and deletes an existing content type", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderRoute();
    await screen.findByText("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "Configure fields" }));
    expect(screen.getByRole("heading", { name: /Configure/ })).toBeTruthy();
    fireEvent.change(document.querySelector("#content-type-name")!, {
      target: { value: "Team members" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save fields" }));
    await waitFor(() =>
      expect(saveStructuredType).toHaveBeenCalledWith(
        expect.objectContaining({ id: "colleagues", name: "Team members" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Configure fields" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete type" }));
    await waitFor(() => expect(deleteStructuredType).toHaveBeenCalledWith("colleagues"));
    expect(await screen.findByText("Content type deleted")).toBeTruthy();
    confirm.mockRestore();
  });

  it("renders no-match and no-workspace states", async () => {
    search = { q: "missing" };
    const filtered = await renderRoute();
    expect(await screen.findByText("No matching colleagues")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    filtered.unmount();

    vi.mocked(loadStructuredContentWorkspace).mockResolvedValueOnce(null);
    await renderRoute();
    expect(await screen.findByText("No structured content workspace is available.")).toBeTruthy();
  });
});

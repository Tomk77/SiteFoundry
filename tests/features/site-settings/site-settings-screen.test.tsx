import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteSettingsScreen } from "@/features/site-settings";
import type { PeopleTab, SettingsDestination } from "@/features/site-settings";
import { createSiteApiToken, listSiteApiTokens } from "@/lib/api-tokens";
import {
  createSiteInvitation,
  loadSiteSettingsWorkspace,
  type SiteSettingsWorkspace,
} from "@/lib/site-settings";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children, active }: { children: React.ReactNode; active: string }) => (
    <div data-active={active}>{children}</div>
  ),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/lib/site-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-settings")>()),
  createSiteInvitation: vi.fn().mockResolvedValue(undefined),
  loadSiteSettingsWorkspace: vi.fn(),
}));

vi.mock("@/lib/api-tokens", () => ({
  createSiteApiToken: vi.fn().mockResolvedValue("scaffold_pub_created-token"),
  listSiteApiTokens: vi.fn().mockResolvedValue([]),
  revokeSiteApiToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const workspace: SiteSettingsWorkspace = {
  viewerRole: "owner",
  site: {
    id: "site-1",
    name: "Northstar Journal",
    slug: "northstar-journal",
    ownerId: "user-1",
    timezone: "Europe/Amsterdam",
    iconUrl: null,
    previewUrl: "https://preview.northstar.example",
  },
  languages: [
    {
      id: "language-en",
      code: "en",
      name: "English",
      isDefault: true,
      position: 0,
      urlPrefix: "",
      pageCount: 12,
    },
    {
      id: "language-nl",
      code: "nl",
      name: "Dutch",
      isDefault: false,
      position: 1,
      urlPrefix: "nl/",
      pageCount: 4,
    },
  ],
  branches: [
    { id: "branch-blog", name: "Blog", languageId: "language-en", languageName: "English" },
  ],
  members: [
    {
      id: "user-1",
      name: "Alex Morgan",
      email: "alex@northstar.example",
      role: "owner",
      accessScope: "full",
      languageIds: ["language-en", "language-nl"],
      branchIds: [],
      sections: ["pages", "media"],
      lastActiveAt: new Date().toISOString(),
      current: true,
    },
  ],
  invitations: [],
  domains: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadSiteSettingsWorkspace).mockResolvedValue(workspace);
  vi.mocked(listSiteApiTokens).mockResolvedValue([]);
});

function Harness() {
  const [destination, setDestination] = useState<SettingsDestination>("general");
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("members");

  return (
    <SiteSettingsScreen
      destination={destination}
      onDestinationChange={setDestination}
      onPeopleTabChange={setPeopleTab}
      peopleTab={peopleTab}
    />
  );
}

describe("site settings screen", () => {
  it("edits and discards general settings without losing the persisted value", async () => {
    render(<Harness />);

    const name = await screen.findByLabelText("Website name");
    fireEvent.change(name, { target: { value: "Northstar Weekly" } });

    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    expect(screen.getByText("Northstar Weekly")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect((name as HTMLInputElement).value).toBe("Northstar Journal");
  });

  it("persists a scoped publisher invitation and keeps a success confirmation", async () => {
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "People & access" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite person" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "publisher@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publisher/ }));
    fireEvent.click(screen.getByRole("button", { name: "Selected languages" }));
    fireEvent.click(screen.getByRole("button", { name: "Dutch" }));
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(await screen.findByRole("heading", { name: "Invitation sent" })).toBeTruthy();
    expect(createSiteInvitation).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        email: "publisher@example.com",
        role: "publisher",
        accessScope: "languages",
        languageIds: ["language-en", "language-nl"],
      }),
    );
  });

  it("uses the persisted viewer role for a useful read-only view", async () => {
    vi.mocked(loadSiteSettingsWorkspace).mockResolvedValue({
      ...workspace,
      viewerRole: "viewer",
    });
    render(<Harness />);

    expect(await screen.findByText("Read only")).toBeTruthy();
    expect((screen.getByDisplayValue("Northstar Journal") as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "People & access" }));
    expect(screen.queryByRole("button", { name: "Invite person" })).toBeNull();
    expect(screen.getByRole("button", { name: "View access for Alex Morgan" })).toBeTruthy();
  });

  it("creates a site-owned publishable delivery token", async () => {
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "API access" }));
    const tokenListHeading = screen.getByRole("heading", { name: "Publishable tokens" });
    const playgroundHeading = screen.getByRole("heading", { name: "GraphQL playground" });
    expect(
      tokenListHeading.compareDocumentPosition(playgroundHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Production website" },
    });
    fireEvent.change(screen.getByLabelText(/Allowed browser origins/), {
      target: { value: "https://northstar.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("scaffold_pub_created-token")).toBeTruthy();
    expect(createSiteApiToken).toHaveBeenCalledWith({
      siteId: "site-1",
      name: "Production website",
      allowedOrigins: "https://northstar.example",
      expiresAt: "",
    });
  });
});

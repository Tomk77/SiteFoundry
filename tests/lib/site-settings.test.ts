import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import {
  createSiteInvitation,
  loadSiteSettingsWorkspace,
  saveSiteGeneralSettings,
  saveSiteMemberAccess,
  setPrimarySiteDomain,
} from "@/lib/site-settings";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("site settings persistence", () => {
  it("normalizes the protected workspace payload", async () => {
    const payload = {
      viewerRole: "admin",
      site: {
        id: "site-1",
        name: "Northstar Journal",
        slug: "northstar-journal",
        ownerId: "owner-1",
        timezone: "Europe/Amsterdam",
        iconUrl: null,
        previewUrl: "https://preview.example.com",
      },
      languages: [
        {
          id: "language-1",
          code: "en",
          name: "English",
          isDefault: true,
          position: 0,
          urlPrefix: "",
          pageCount: 12,
        },
      ],
      branches: [],
      members: [
        {
          id: "user-1",
          name: "Alex Morgan",
          email: "alex@example.com",
          role: "owner",
          accessScope: "full",
          languageIds: ["language-1"],
          branchIds: [],
          sections: ["pages"],
          lastActiveAt: null,
          current: true,
        },
      ],
      invitations: [],
      domains: [
        {
          id: "domain-1",
          hostname: "example.com",
          isPrimary: true,
          status: "verified",
          verificationMessage: "",
        },
      ],
    };
    const mock = createSupabaseMock({
      rpc: { get_site_settings_workspace: [mockResult(payload)] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    const workspace = await loadSiteSettingsWorkspace();

    expect(workspace?.viewerRole).toBe("admin");
    expect(workspace?.site.name).toBe("Northstar Journal");
    expect(workspace?.members[0]?.email).toBe("alex@example.com");
    expect(workspace?.domains[0]?.status).toBe("verified");
    expect(mock.client.rpc).toHaveBeenCalledWith("get_site_settings_workspace", {
      target_site_id: undefined,
    });
  });

  it("persists general settings through the sites table", async () => {
    const mock = createSupabaseMock({ tables: { sites: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await saveSiteGeneralSettings("site-1", {
      name: "Northstar Weekly",
      slug: "northstar-weekly",
      timezone: "Europe/London",
      previewUrl: "https://preview.example.com",
    });

    expect(mock.calls).toContainEqual({ method: "from", args: ["sites"] });
    expect(mock.calls).toContainEqual({ method: "eq", args: ["id", "site-1"] });
    expect(mock.calls.find((call) => call.method === "update")?.args[0]).toEqual({
      name: "Northstar Weekly",
      slug: "northstar-weekly",
      timezone: "Europe/London",
      preview_url: "https://preview.example.com",
    });
  });

  it("persists invitations and delegates protected mutations to database functions", async () => {
    const mock = createSupabaseMock({
      tables: { site_invitations: [mockResult(null)] },
      rpc: {
        update_site_member_access: [mockResult(null)],
        set_primary_site_domain: [mockResult(null)],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await createSiteInvitation("site-1", {
      email: " Editor@Example.com ",
      role: "editor",
      accessScope: "languages",
      languageIds: ["language-1"],
      branchIds: [],
      sections: ["pages", "media"],
    });
    await saveSiteMemberAccess("site-1", {
      id: "user-2",
      role: "publisher",
      accessScope: "branches",
      languageIds: [],
      branchIds: ["page-1"],
      sections: ["pages"],
    });
    await setPrimarySiteDomain("site-1", "domain-1");

    expect(mock.calls.find((call) => call.method === "insert")?.args[0]).toEqual(
      expect.objectContaining({ email: "editor@example.com", site_id: "site-1" }),
    );
    expect(mock.client.rpc).toHaveBeenCalledWith(
      "update_site_member_access",
      expect.objectContaining({ target_user_id: "user-2", target_role: "publisher" }),
    );
    expect(mock.client.rpc).toHaveBeenCalledWith("set_primary_site_domain", {
      target_site_id: "site-1",
      target_domain_id: "domain-1",
    });
  });

  it("surfaces Supabase errors without masking them", async () => {
    const mock = createSupabaseMock({
      rpc: { get_site_settings_workspace: [mockResult(null, new Error("permission denied"))] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await expect(loadSiteSettingsWorkspace()).rejects.toThrow("permission denied");
  });
});

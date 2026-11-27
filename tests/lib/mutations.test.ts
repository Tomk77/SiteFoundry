import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import { deleteRedirect, saveRedirect } from "@/lib/redirects";
import {
  deleteSite,
  deleteSiteLanguage,
  requestDomainVerification,
  revokeSiteInvitation,
  saveSiteGeneralSettings,
} from "@/lib/site-settings";
import { deleteStructuredRecord, deleteStructuredType } from "@/lib/structured-content-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

beforeEach(() => vi.clearAllMocks());

// Row level security filters rows out silently; an empty result must not look like success (5.7).
const unchanged = /not changed/;

function noRows(table: string) {
  const mock = createSupabaseMock({ tables: { [table]: [mockResult([])] } });
  vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

  return mock;
}

describe("mutations that RLS filtered out (5.7)", () => {
  it.each([
    [
      "sites",
      () =>
        saveSiteGeneralSettings("site-1", {
          name: "A",
          slug: "a",
          timezone: "UTC",
          previewUrl: "",
        }),
    ],
    ["site_invitations", () => revokeSiteInvitation("invitation-1")],
    ["site_languages", () => deleteSiteLanguage("language-1")],
    ["site_domains", () => requestDomainVerification("domain-1")],
    ["sites", () => deleteSite("site-1")],
    ["content_records", () => deleteStructuredRecord("record-1")],
    ["content_types", () => deleteStructuredType("type-1")],
    ["redirects", () => deleteRedirect("redirect-1")],
  ])("reports %s as not changed", async (table, run) => {
    noRows(table);

    await expect(run()).rejects.toThrow(unchanged);
  });

  it("still succeeds when a row was changed", async () => {
    const mock = createSupabaseMock({
      tables: { site_invitations: [mockResult([{ id: "invitation-1" }])] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await expect(revokeSiteInvitation("invitation-1")).resolves.toBeUndefined();
  });

  it("reports an edited redirect that no longer exists", async () => {
    noRows("redirects");

    await expect(
      saveRedirect({
        id: "redirect-1",
        siteLanguageId: "language-1",
        sourcePath: "/old",
        destinationPath: "/new",
        statusCode: 301,
      }),
    ).rejects.toThrow(unchanged);
  });
});

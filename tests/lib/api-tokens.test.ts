import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import { createSiteApiToken, normalizeAllowedOrigins, revokeSiteApiToken } from "@/lib/api-tokens";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("API token origins", () => {
  it("normalizes and deduplicates origins", () => {
    expect(
      normalizeAllowedOrigins(
        "https://northstar.example, http://localhost:3000\nhttps://northstar.example",
      ),
    ).toEqual(["https://northstar.example", "http://localhost:3000"]);
  });

  it("rejects URLs with paths", () => {
    expect(() => normalizeAllowedOrigins("https://northstar.example/path")).toThrow(
      "Use an origin without a path",
    );
  });
});

describe("API token lifecycle", () => {
  it("asks the database to generate the secret and returns it once", async () => {
    const mock = createSupabaseMock({
      rpc: {
        create_site_api_token: [
          mockResult({ id: "token-1", token: "scaffold_pub_generated-by-database" }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    const secret = await createSiteApiToken({
      siteId: "site-1",
      name: " Website ",
      allowedOrigins: "https://northstar.example",
      expiresAt: "2030-01-31",
    });

    expect(secret).toBe("scaffold_pub_generated-by-database");
    expect(mock.client.rpc).toHaveBeenCalledWith("create_site_api_token", {
      target_site_id: "site-1",
      target_name: "Website",
      target_allowed_origins: ["https://northstar.example"],
      target_expires_at: "2030-01-31T23:59:59.999Z",
    });
    expect(mock.client.from).not.toHaveBeenCalled();
  });

  it("rejects a response without a secret", async () => {
    const mock = createSupabaseMock({ rpc: { create_site_api_token: [mockResult({ id: "x" })] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await expect(
      createSiteApiToken({ siteId: "site-1", name: "Website", allowedOrigins: "", expiresAt: "" }),
    ).rejects.toThrow("did not return a token");
    expect(mock.client.rpc).toHaveBeenCalledWith(
      "create_site_api_token",
      expect.objectContaining({ target_allowed_origins: [], target_expires_at: null }),
    );
  });

  it("revokes through the database function", async () => {
    const mock = createSupabaseMock();
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mock.client as never);

    await revokeSiteApiToken("token-1");

    expect(mock.client.rpc).toHaveBeenCalledWith("revoke_site_api_token", {
      target_token_id: "token-1",
    });
    expect(mock.client.from).not.toHaveBeenCalled();
  });
});

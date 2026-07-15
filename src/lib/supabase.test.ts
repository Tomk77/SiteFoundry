import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ kind: "supabase-client" })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  createBrowserClient.mockClear();
});

describe("Supabase browser configuration", () => {
  it("returns null if either public setting is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const { getSupabaseBrowserClient } = await import("./supabase");
    expect(getSupabaseBrowserClient()).toBeNull();
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("creates and caches one configured browser client", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const { getSupabaseBrowserClient } = await import("./supabase");

    const first = getSupabaseBrowserClient();
    expect(getSupabaseBrowserClient()).toBe(first);
    expect(createBrowserClient).toHaveBeenCalledOnce();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
    );
  });

  it("provides an actionable configuration error", async () => {
    const { getSupabaseConfigError } = await import("./supabase");
    expect(getSupabaseConfigError().message).toContain("VITE_SUPABASE_URL");
    expect(getSupabaseConfigError().message).toContain(".env.local");
  });
});

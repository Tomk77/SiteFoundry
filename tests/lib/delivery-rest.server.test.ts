// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeliveryRestRequest } from "@/lib/delivery-rest.server";

const token = "scaffold_pub_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const base = "http://cms.test/api/v1/sites/site-one";

const bundle = {
  site: { id: "site-1", key: "site-one", name: "Site one", timezone: "UTC", domains: [] },
  languages: [{ id: "language-1", code: "en", name: "English", default: true, urlPrefix: "" }],
  pages: [
    {
      id: "page-1",
      parentId: null,
      languageId: "language-1",
      locale: "en",
      title: "Home",
      slug: "",
      path: "/",
      templateName: "Landing page",
      templateKey: "landing-page",
      blocks: [],
      seo: { title: "", description: "", socialImage: null },
      revisionId: "revision-1",
      revisionVersion: 1,
      publishedAt: "2026-11-27T10:00:00Z",
    },
  ],
  contentTypes: [],
  navigation: [],
  redirects: [],
  media: [],
};

function upstream(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = "http://supabase.test";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("delivery REST handler", () => {
  it("sends the raw token to the database, which hashes it (3.5)", async () => {
    const fetch = upstream(200, bundle);
    vi.stubGlobal("fetch", fetch);

    const response = await handleDeliveryRestRequest(request("/site"), "site-one");

    expect(response.status).toBe(200);
    const init = fetch.mock.calls[0]?.[1] as { body: string } | undefined;
    const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    expect(body).toEqual({ target_site_key: "site-one", target_token: token, target_origin: null });
  });

  it("never lets shared caches mix up tokens or origins (3.1)", async () => {
    vi.stubGlobal("fetch", upstream(200, bundle));

    const response = await handleDeliveryRestRequest(request("/site"), "site-one");

    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    expect(response.headers.get("vary")).toBe("Authorization, Origin");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it("answers a matching If-None-Match with 304", async () => {
    vi.stubGlobal("fetch", upstream(200, bundle));
    const first = await handleDeliveryRestRequest(request("/site"), "site-one");
    vi.stubGlobal("fetch", upstream(200, bundle));

    const second = await handleDeliveryRestRequest(
      request("/site", { headers: { "if-none-match": first.headers.get("etag") ?? "" } }),
      "site-one",
    );

    expect(second.status).toBe(304);
  });

  it.each([
    ["28000", 401, "unauthorized"],
    ["42501", 403, "origin_forbidden"],
    ["54000", 429, "rate_limited"],
    ["PGRST202", 502, "upstream_error"],
  ])("maps SQLSTATE %s to %i (3.7)", async (code, status, problem) => {
    vi.stubGlobal("fetch", upstream(400, { code, message: "rate origin something" }));

    const response = await handleDeliveryRestRequest(request("/site"), "site-one");

    expect(response.status).toBe(status);
    expect(((await response.json()) as { code: string }).code).toBe(problem);
  });

  it("reports an unreachable database as 502, not as a bad token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const response = await handleDeliveryRestRequest(request("/site"), "site-one");

    expect(response.status).toBe(502);
  });

  it("rejects a missing token before calling the database", async () => {
    const fetch = upstream(200, bundle);
    vi.stubGlobal("fetch", fetch);

    const response = await handleDeliveryRestRequest(new Request(`${base}/site`), "site-one");

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answers other methods with 405 and an Allow header (3.8)", async () => {
    const response = await handleDeliveryRestRequest(
      request("/site", { method: "POST" }),
      "site-one",
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, OPTIONS");
  });

  it("returns 400 for malformed percent-encoding (3.7)", async () => {
    vi.stubGlobal("fetch", upstream(200, bundle));

    const response = await handleDeliveryRestRequest(request("/pages/%E0%A4%A"), "site-one");

    expect(response.status).toBe(400);
  });

  it("returns 404 for records of an unknown content type (3.8)", async () => {
    vi.stubGlobal("fetch", upstream(200, bundle));

    const response = await handleDeliveryRestRequest(
      request("/content-types/missing/records"),
      "site-one",
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid pagination cursor (3.8)", async () => {
    vi.stubGlobal("fetch", upstream(200, bundle));

    const response = await handleDeliveryRestRequest(
      request("/pages?after=not-a-cursor"),
      "site-one",
    );

    expect(response.status).toBe(400);
  });

  it("allows the requesting origin in CORS responses", async () => {
    vi.stubGlobal("fetch", upstream(200, bundle));

    const response = await handleDeliveryRestRequest(
      request("/site", { headers: { origin: "https://www.example.test" } }),
      "site-one",
    );

    expect(response.headers.get("access-control-allow-origin")).toBe("https://www.example.test");
  });
});
